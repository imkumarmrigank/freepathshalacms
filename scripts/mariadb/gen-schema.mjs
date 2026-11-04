/**
 * Builds the MariaDB schema from the live PostgreSQL one.
 *
 *   DATABASE_URL=postgres://… node scripts/mariadb/gen-schema.mjs
 *
 * Writes db/mariadb/schema.sql (tables + keys), foreign-keys.sql and triggers.sql.
 * Anything it cannot translate cleanly is printed as a WARNING and left for a person.
 */
import fs from "node:fs";
import path from "node:path";
import { connect, loadModel } from "./introspect.mjs";

const OUT = path.join(process.cwd(), "db", "mariadb");
fs.mkdirSync(OUT, { recursive: true });

const pool = connect(process.env.DATABASE_URL);
const model = await loadModel(pool);
const warnings = [];
const warn = (m) => warnings.push(m);

const q = (id) => "`" + id + "`";
const list = (cols) => cols.map(q).join(", ");

/* ------------------------------------------------------------------ helpers */

/** Postgres expression text -> something MariaDB accepts, for CHECKs and predicates. */
function expr(pgExpr, where) {
  let e = pgExpr;
  e = e.replace(/::(?:text|numeric|bigint|integer|int|smallint|boolean|date|character varying|double precision)(?:\[\])?/g, "");
  e = e.replace(/(\w+) = ANY \(ARRAY\[([^\]]*)\]\)/g, "$1 IN ($2)");
  e = e.replace(/\bbtrim\(/g, "TRIM(");
  e = e.replace(/array_length\((\w+), 1\)/g, "JSON_LENGTH($1)");
  if (/::|ANY|ARRAY|\bILIKE\b/.test(e)) warn(`${where}: could not fully translate: ${pgExpr} -> ${e}`);
  return e;
}

/** Column default -> MariaDB DEFAULT clause ('' when none or auto-increment). */
function dflt(col, isTimestamp) {
  const d = col.dflt;
  if (d == null) return "";
  if (/^nextval\(/.test(d)) return "";
  if (d === "now()") return " DEFAULT CURRENT_TIMESTAMP(6)";
  if (d === "CURRENT_DATE") return " DEFAULT (CURDATE())";
  if (d === "true") return " DEFAULT 1";
  if (d === "false") return " DEFAULT 0";
  if (/^-?\d+(\.\d+)?$/.test(d)) return ` DEFAULT ${d}`;
  let m = d.match(/^'((?:[^']|'')*)'::(?:text|character varying)$/);
  if (m) return ` DEFAULT '${m[1]}'`;
  if (d === "'[]'::jsonb" || d === "'{}'::text[]") return " DEFAULT '[]'";
  if (d === "'{}'::jsonb") return " DEFAULT '{}'";
  warn(`${col.tbl}.${col.col}: unhandled default ${d}`);
  return "";
}

/* ------------------------------------------- which text columns sit in an index */
const indexedText = new Set();
for (const t of Object.values(model)) {
  const mark = (cols) => (cols || []).forEach((c) => indexedText.add(`${t.name}.${c}`));
  for (const k of t.constraints) if (["p", "u", "f"].includes(k.type)) mark(k.cols);
  for (const i of t.indexes) if (i.method === "btree") mark(i.cols);
  // referenced columns of foreign keys must match the type of the column they point at
  for (const k of t.constraints) if (k.type === "f") (k.ref_cols || []).forEach((c) => indexedText.add(`${k.ref_tbl}.${c}`));
}

/** Longest value actually stored, so VARCHAR / TEXT sizes are not guesses. */
const maxLen = {};
for (const t of Object.values(model)) {
  const textCols = t.columns.filter((c) => c.udt === "text").map((c) => c.col);
  if (!textCols.length) continue;
  const sel = textCols.map((c) => `max(char_length("${c}")) AS "${c}"`).join(", ");
  const r = (await pool.query(`SELECT ${sel} FROM "${t.name}"`)).rows[0];
  for (const c of textCols) maxLen[`${t.name}.${c}`] = Number(r[c] ?? 0);
}

// PostgreSQL lets a 32-bit column reference a 64-bit key; MariaDB insists the types match.
// Collect those pairs so the referencing column can be widened to the referenced type.
const widenTo = {};
for (const t of Object.values(model)) {
  for (const k of t.constraints.filter((k) => k.type === "f")) {
    k.cols.forEach((c, i) => {
      const child = t.columns.find((x) => x.col === c);
      const parent = model[k.ref_tbl].columns.find((x) => x.col === k.ref_cols[i]);
      if (child && parent && child.udt !== parent.udt && /^int[248]$/.test(child.udt) && /^int[248]$/.test(parent.udt)) {
        widenTo[`${t.name}.${c}`] = parent.udt;
      }
    });
  }
}

function sqlType(col) {
  const key = `${col.tbl}.${col.col}`;
  if (widenTo[key]) col = { ...col, udt: widenTo[key] };
  if (col.is_array) return "JSON";
  switch (col.udt) {
    case "int8": return "BIGINT";
    case "int4": return "INT";
    case "int2": return "SMALLINT";
    case "bool": return "TINYINT(1)";
    case "float8": return "DOUBLE";
    case "date": return "DATE";
    case "time": return "TIME";
    case "timestamptz": return "TIMESTAMP(6)";
    case "jsonb": return "JSON";
    case "bytea": return "LONGBLOB";
    case "numeric": {
      const m = col.fmt.match(/numeric\((\d+),(\d+)\)/);
      if (!m) { warn(`${key}: numeric without precision`); return "DECIMAL(30,10)"; }
      return `DECIMAL(${m[1]},${m[2]})`;
    }
    case "text": {
      const n = maxLen[key] ?? 0;
      if (indexedText.has(key)) {
        const size = Math.max(255, Math.min(700, Math.ceil((n * 1.5) / 50) * 50));
        if (n > 700) warn(`${key}: indexed text is ${n} chars; truncation risk`);
        return `VARCHAR(${size})`;
      }
      if (n > 16_000_000) return "LONGTEXT";
      if (n > 60_000) return "MEDIUMTEXT";
      return "TEXT";
    }
    default:
      warn(`${key}: unhandled type ${col.udt}`);
      return "TEXT";
  }
}

/* --------------------------------------------------------------- build tables */
const tableSql = [];
const fkSql = [];
const names = Object.keys(model).sort();

for (const name of names) {
  const t = model[name];
  const lines = [];
  const pk = t.constraints.find((k) => k.type === "p");

  for (const col of t.columns) {
    const type = sqlType(col);
    const auto = col.dflt && /^nextval\(/.test(col.dflt);
    const ts = col.udt === "timestamptz";
    let line = `  ${q(col.col)} ${type}`;
    const d = auto ? "" : dflt(col, ts);
    if (col.notnull) line += " NOT NULL";
    else if (ts) line += " NULL"; // a nullable TIMESTAMP must say so, or MariaDB invents a default
    line += auto ? " AUTO_INCREMENT" : d || (ts && !col.notnull ? " DEFAULT NULL" : "");
    lines.push(line);
  }

  if (pk) lines.push(`  PRIMARY KEY (${list(pk.cols)})`);

  // UNIQUE constraints
  for (const k of t.constraints.filter((k) => k.type === "u")) {
    lines.push(`  UNIQUE KEY ${q(k.name)} (${list(k.cols)})`);
  }

  // indexes that are not backed by a constraint
  const generated = [];
  for (const i of t.indexes) {
    if (i.pk || i.backs_constraint) continue;
    if (i.method !== "btree") { warn(`${name}.${i.name}: ${i.method} index dropped (not portable)`); continue; }
    if (i.has_expr) {
      if (i.name === "uq_sports_centre_name") {
        // unique on (centre, lower(name)): the table collation is case-insensitive, so a plain
        // unique key on the two columns does it. (i.cols omits the expression column.)
        lines.push(`  UNIQUE KEY ${q(i.name)} (${q("center_id")}, ${q("name")})`);
      } else if (i.name === "uq_teacher_day_note") {
        generated.push(`  ${q("_cl0")} BIGINT AS (COALESCE(${q("class_level_id")}, 0)) VIRTUAL INVISIBLE`);
        lines.push(`  UNIQUE KEY ${q(i.name)} (${q("user_id")}, ${q("on_date")}, ${q("_cl0")})`);
      } else {
        warn(`${name}.${i.name}: expression index needs manual work: ${i.def}`);
      }
      continue;
    }
    if (i.pred) {
      if (i.uniq) {
        // A partial UNIQUE index becomes a hidden column that is 1 when the predicate holds and
        // NULL otherwise. NULLs never collide in a unique key, so only matching rows are constrained.
        const g = `_u_${i.name}`.slice(0, 60);
        generated.push(`  ${q(g)} TINYINT AS (CASE WHEN ${expr(i.pred, `${name}.${i.name}`)} THEN 1 END) VIRTUAL INVISIBLE`);
        lines.push(`  UNIQUE KEY ${q(i.name)} (${list(i.cols)}, ${q(g)})`);
      } else {
        lines.push(`  KEY ${q(i.name)} (${list(i.cols)})`);
      }
      continue;
    }
    lines.push(`  ${i.uniq ? "UNIQUE KEY" : "KEY"} ${q(i.name)} (${list(i.cols)})`);
  }
  // generated columns go after the real ones, before the keys that use them
  const colEnd = t.columns.length;
  lines.splice(colEnd, 0, ...generated);

  // CHECK constraints
  for (const k of t.constraints.filter((k) => k.type === "c")) {
    const body = k.def.replace(/^CHECK \(/, "").replace(/\)$/, "");
    lines.push(`  CONSTRAINT ${q(k.name)} CHECK (${expr(body, `${name}.${k.name}`)})`);
  }

  tableSql.push(
    `CREATE TABLE ${q(name)} (\n${lines.join(",\n")}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  );

  for (const k of t.constraints.filter((k) => k.type === "f")) {
    const act = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" };
    fkSql.push(
      `ALTER TABLE ${q(name)} ADD CONSTRAINT ${q(k.name.slice(0, 64))} FOREIGN KEY (${list(k.cols)}) ` +
      `REFERENCES ${q(k.ref_tbl)} (${list(k.ref_cols)}) ON DELETE ${act[k.on_delete]} ON UPDATE ${act[k.on_update]};`,
    );
  }
}

/* ------------------------------------------------------------------ triggers */
const triggers = `-- Rewritten from the two PL/pgSQL triggers. Statements are separated by //
CREATE TRIGGER trg_students_status_change BEFORE UPDATE ON students FOR EACH ROW
BEGIN
  IF NOT (NEW.status <=> OLD.status) AND (NEW.status_changed_at <=> OLD.status_changed_at) THEN
    SET NEW.status_changed_at = CURRENT_TIMESTAMP(6);
  END IF;
END
//
CREATE TRIGGER trg_enrollments_section_ins BEFORE INSERT ON enrollments FOR EACH ROW
BEGIN
  IF NEW.section IS NULL OR TRIM(NEW.section) = '' THEN
    SET NEW.section = COALESCE((SELECT default_section FROM centers WHERE id = NEW.center_id), 'M');
  ELSE
    SET NEW.section = UPPER(TRIM(NEW.section));
  END IF;
END
//
CREATE TRIGGER trg_enrollments_section_upd BEFORE UPDATE ON enrollments FOR EACH ROW
BEGIN
  IF NEW.section IS NULL OR TRIM(NEW.section) = '' THEN
    SET NEW.section = COALESCE((SELECT default_section FROM centers WHERE id = NEW.center_id), 'M');
  ELSE
    SET NEW.section = UPPER(TRIM(NEW.section));
  END IF;
END
//
`;

const header = "-- Generated by scripts/mariadb/gen-schema.mjs from the live PostgreSQL schema. Do not edit by hand.\n";
fs.writeFileSync(path.join(OUT, "schema.sql"), header + tableSql.join("\n\n") + "\n");
fs.writeFileSync(path.join(OUT, "foreign-keys.sql"), header + fkSql.join("\n") + "\n");
fs.writeFileSync(path.join(OUT, "triggers.sql"), triggers);

// Which column names are always DATE columns? The SQL translator uses this to turn
// PostgreSQL's `date - date` (days) into DATEDIFF, which MariaDB would otherwise get wrong.
{
  const types = {};
  for (const t of Object.values(model)) for (const c of t.columns) (types[c.col] ??= new Set()).add(c.udt);
  const dates = Object.entries(types).filter(([, v]) => v.size === 1 && v.has("date")).map(([k]) => k).sort();
  const stamps = Object.entries(types).filter(([, v]) => v.size === 1 && v.has("timestamptz")).map(([k]) => k).sort();
  fs.writeFileSync(
    path.join(process.cwd(), "src", "lib", "sql-columns.ts"),
    "// Generated by scripts/mariadb/gen-schema.mjs. Column names that are only ever DATE / TIMESTAMP.\n" +
    `export const DATE_COLUMNS = new Set(${JSON.stringify(dates)});\n` +
    `export const TIMESTAMP_COLUMNS = new Set(${JSON.stringify(stamps)});\n`,
  );
}

console.log(`tables: ${names.length}, foreign keys: ${fkSql.length}`);
console.log(warnings.length ? "WARNINGS:\n" + warnings.map((w) => " - " + w).join("\n") : "no warnings");
await pool.end();
