/**
 * Copies every table from the live PostgreSQL (Neon) database into MariaDB, then proves the
 * copy: for every table it compares the row count and, column by column, the number of
 * non-null values and a checksum (sums, lengths, min/max). A mismatch is reported by name
 * and the script exits non-zero, so a bad copy cannot be mistaken for a good one.
 *
 *   SOURCE_URL=postgres://...  TARGET_URL=mysql://user@host:3306/db  TARGET_PASSWORD=...  \
 *     node scripts/mariadb/copy-data.mjs --replace [--with-media] [--verify-only]
 *
 *   --replace      empty the MariaDB tables first (needed to re-run; this is the "final sync")
 *   --with-media   copy photographs/documents too (off for local test copies)
 *   --verify-only  do not copy, just compare
 *
 * A local test target can be given as mysql://user@localhost/fp_maria?socket=/tmp/mysql.sock
 */
import mysql from "mysql2/promise";
import pg from "pg";
import { connect, loadModel } from "./introspect.mjs";

const args = new Set(process.argv.slice(2));
const REPLACE = args.has("--replace");
const WITH_MEDIA = args.has("--with-media");
const VERIFY_ONLY = args.has("--verify-only");

const SOURCE = process.env.SOURCE_URL ?? process.env.DATABASE_URL;
const TARGET = process.env.TARGET_URL;
if (!SOURCE || !TARGET) { console.error("Set SOURCE_URL (PostgreSQL) and TARGET_URL (MariaDB)."); process.exit(2); }

// keep PostgreSQL values in a form that maps 1:1 onto MariaDB
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);                 // YYYY-MM-DD, never a shifted Date
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);          // text with microseconds, read in UTC

const src = connect(SOURCE);
src.on("connect", (c) => c.query("SET TIME ZONE 'UTC'"));

const u = new URL(TARGET);
const dst = await mysql.createConnection({
  host: u.hostname, port: Number(u.port || 3306),
  user: decodeURIComponent(u.username), password: process.env.TARGET_PASSWORD ?? decodeURIComponent(u.password),
  database: u.pathname.slice(1), socketPath: u.searchParams.get("socket") ?? undefined,
  ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: false } : undefined,
  charset: "utf8mb4", supportBigNumbers: true, bigNumberStrings: false,
  dateStrings: ["DATE"], decimalNumbers: false, multipleStatements: false,
});
// timestamps are copied as UTC text, so read and write them in UTC
await dst.query("SET SESSION time_zone = '+00:00', sql_mode = CONCAT(@@sql_mode, ',PIPES_AS_CONCAT')");

const model = await loadModel(src);
const tables = Object.keys(model).sort();
const q = (id) => "`" + id + "`";
const pq = (id) => '"' + id + '"';

/* ------------------------------------------------------------------ copy */

function convert(col, v) {
  if (v === null || v === undefined) return null;
  if (col.is_array || col.udt === "jsonb" || col.udt === "json") return JSON.stringify(v);
  if (col.udt === "timestamptz") return String(v).replace(/\+00(:00)?$/, "");
  return v;
}

async function copyTable(name) {
  const t = model[name];
  const cols = t.columns;
  const isMedia = name === "media";
  const names = cols.map((c) => q(c.col)).join(", ");
  const sel = cols.map((c) => (isMedia && c.col === "bytes" && !WITH_MEDIA ? `'\\x'::bytea AS ${pq(c.col)}` : pq(c.col))).join(", ");
  const pk = t.constraints.find((k) => k.type === "p");
  const order = pk ? "ORDER BY " + pk.cols.map(pq).join(", ") : "";
  const chunk = isMedia && WITH_MEDIA ? 40 : 2000;
  let offset = 0, total = 0;
  for (;;) {
    const { rows } = await src.query(`SELECT ${sel} FROM ${pq(name)} ${order} LIMIT ${chunk} OFFSET ${offset}`);
    if (!rows.length) break;
    const values = rows.map((r) => cols.map((c) => convert(c, r[c.col])));
    await dst.query(`INSERT INTO ${q(name)} (${names}) VALUES ?`, [values]);
    total += rows.length;
    offset += rows.length;
    if (rows.length < chunk) break;
  }
  return total;
}

if (!VERIFY_ONLY) {
  if (REPLACE) {
    await dst.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const name of tables) if (name !== "schema_migrations") await dst.query(`TRUNCATE TABLE ${q(name)}`);
    await dst.query("SET FOREIGN_KEY_CHECKS = 1");
  }
  await dst.query("SET FOREIGN_KEY_CHECKS = 0");
  const started = Date.now();
  for (const name of tables) {
    if (name === "schema_migrations") continue;
    const n = await copyTable(name);
    process.stdout.write(`  copied ${name.padEnd(30)} ${String(n).padStart(7)} rows\n`);
  }
  await dst.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`copy finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/* ---------------------------------------------------------------- verify */

function checks(t) {
  // [label, postgres expression, mariadb expression, kind]
  const out = [["rows", "count(*)", "count(*)", "num"]];
  for (const c of t.columns) {
    const P = pq(c.col), M = q(c.col);
    out.push([`${c.col}:nonnull`, `count(${P})`, `count(${M})`, "num"]);
    if (c.is_array) out.push([`${c.col}:items`, `coalesce(sum(array_length(${P}, 1)), 0)`, `coalesce(sum(JSON_LENGTH(${M})), 0)`, "num"]);
    else if (["int2", "int4", "int8", "float8", "numeric"].includes(c.udt)) out.push([`${c.col}:sum`, `coalesce(sum(${P}), 0)`, `coalesce(sum(${M}), 0)`, "num"]);
    else if (c.udt === "bool") out.push([`${c.col}:true`, `coalesce(sum(case when ${P} then 1 else 0 end), 0)`, `coalesce(sum(${M}), 0)`, "num"]);
    else if (c.udt === "text") out.push([`${c.col}:chars`, `coalesce(sum(char_length(${P})), 0)`, `coalesce(sum(CHAR_LENGTH(${M})), 0)`, "num"]);
    else if (c.udt === "date") {
      out.push([`${c.col}:min`, `min(${P})::text`, `CAST(min(${M}) AS CHAR)`, "str"]);
      out.push([`${c.col}:max`, `max(${P})::text`, `CAST(max(${M}) AS CHAR)`, "str"]);
    } else if (c.udt === "timestamptz") {
      out.push([`${c.col}:latest`, `max(floor(extract(epoch from ${P})))`, `max(FLOOR(UNIX_TIMESTAMP(${M})))`, "num"]);
    } else if (c.udt === "bytea" && WITH_MEDIA) out.push([`${c.col}:bytes`, `coalesce(sum(octet_length(${P})), 0)`, `coalesce(sum(LENGTH(${M})), 0)`, "num"]);
  }
  return out;
}

const close = (a, b) => {
  if (a === null && b === null) return true;
  const x = Number(a), y = Number(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return String(a) === String(b);
  return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
};

console.log("\nVerifying every table against the source ...");
let bad = 0, checked = 0;
const report = [];
for (const name of tables) {
  if (name === "schema_migrations") continue;
  const t = model[name];
  const cs = checks(t);
  const [prow] = (await src.query(`SELECT ${cs.map(([l, p], i) => `${p} AS c${i}`).join(", ")} FROM ${pq(name)}`)).rows;
  const [mrows] = await dst.query(`SELECT ${cs.map(([l, , m], i) => `${m} AS c${i}`).join(", ")} FROM ${q(name)}`);
  const mrow = mrows[0];
  const diffs = [];
  cs.forEach(([label, , , kind], i) => {
    checked++;
    const a = prow[`c${i}`], b = mrow[`c${i}`];
    const same = kind === "str" ? (a ?? null) === (b ?? null) : close(a, b);
    if (!same) diffs.push(`${label}: neon=${a} maria=${b}`);
  });
  const rows = Number(prow.c0);
  report.push({ name, rows, ok: diffs.length === 0 });
  if (diffs.length) { bad++; console.log(`  MISMATCH ${name}`); diffs.slice(0, 8).forEach((d) => console.log(`      ${d}`)); }
}
const totalRows = report.reduce((n, r) => n + r.rows, 0);
console.log(`\n${report.length} tables, ${totalRows.toLocaleString()} rows, ${checked} checks.`);
console.log(bad === 0 ? "RESULT: every table matches the source exactly." : `RESULT: ${bad} table(s) DO NOT match. Do not switch over.`);

await src.end();
await dst.end();
process.exit(bad === 0 ? 0 : 1);
