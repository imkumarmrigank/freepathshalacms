/**
 * Static check of every SQL statement in src/: translate it, then have MariaDB prepare it
 * against the real schema (PREPARE validates syntax, tables and columns without running it).
 *
 *   node --experimental-strip-types scripts/mariadb/check-sql.mjs [--verbose]
 *
 * Needs a MariaDB with the schema loaded; set MARIA_DB (default fp_maria) and MARIA_SOCKET.
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { compile, bind, configure, warnings } from "../../src/lib/sql-compat.ts";
import { DATE_COLUMNS, TIMESTAMP_COLUMNS } from "../../src/lib/sql-columns.ts";
configure({ dateColumns: DATE_COLUMNS, timestampColumns: TIMESTAMP_COLUMNS });

const ROOT = path.join(process.cwd(), "src");
const verbose = process.argv.includes("--verbose");

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f.name)) out.push(p);
  }
  return out;
}

/** every backtick template in the file, with ${...} located by brace matching */
function templates(src) {
  const found = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === "`") {
      let j = i + 1, depth = 0, buf = "", parts = [];
      while (j < src.length) {
        const c = src[j];
        if (c === "\\") { buf += src[j + 1] ?? ""; j += 2; continue; }
        if (depth === 0 && c === "`") break;
        if (c === "$" && src[j + 1] === "{") {
          let k = j + 2, d = 1;
          while (k < src.length && d > 0) { if (src[k] === "{") d++; else if (src[k] === "}") d--; k++; }
          parts.push({ text: buf, expr: src.slice(j + 2, k - 1) });
          buf = ""; j = k; continue;
        }
        buf += c; j++;
      }
      parts.push({ text: buf, expr: null });
      found.push({ parts, at: i });
      i = j + 1;
    } else i++;
  }
  return found;
}

const SQLISH = /\b(SELECT\b[\s\S]*\bFROM\b|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|WITH\s+\w+\s+AS\s*\()/i;

// constants that are plain SQL fragments (no interpolation), so ${NAME} can be filled in
const files = walk(ROOT);
const globalConsts = {};            // ALL_CAPS fragments (SIBLING_JOIN, IST, ...) usable from any file
const fileConsts = new Map();       // everything else only counts inside its own file
const pending = [];                 // constants that interpolate other constants: resolved below
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const local = {};
  fileConsts.set(f, local);
  for (const t of templates(src)) {
    const before = src.slice(Math.max(0, t.at - 120), t.at);
    const m = before.match(/(?:const|let)\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:\n\s*)?$/);
    if (!m) continue;
    if (t.parts.every((p) => p.expr === null)) {
      const body = t.parts.map((p) => p.text).join("");
      local[m[1]] = body;
      if (/^[A-Z][A-Z0-9_]+$/.test(m[1])) globalConsts[m[1]] = body;
    } else if (/^[A-Z][A-Z0-9_]+$/.test(m[1]) && t.parts.every((p) => p.expr === null || /^[A-Z][A-Z0-9_]+$/.test(p.expr.trim()))) {
      pending.push({ name: m[1], parts: t.parts, local });
    }
  }
}
// resolve constants built from other constants (SIBLING_COLS uses SIBLING_COUNT ...)
for (let round = 0; round < 5; round++) {
  for (const c of pending) {
    if (c.name in globalConsts) continue;
    if (c.parts.every((p) => p.expr === null || p.expr.trim() in globalConsts)) {
      const body = c.parts.map((p) => p.text + (p.expr === null ? "" : globalConsts[p.expr.trim()])).join("");
      globalConsts[c.name] = body; c.local[c.name] = body;
    }
  }
}

function fill(t, file) {
  let sql = "";
  t.parts.forEach((p, idx) => {
    sql += p.text;
    if (p.expr === null) return;
    const name = p.expr.trim();
    if (/^\$$/.test(sql.slice(-1))) { sql = sql.slice(0, -1) + "$1"; return; } // $${params.length}
    const local = fileConsts.get(file) ?? {};
    if (name in local) sql += local[name];
    else if (name in globalConsts) sql += globalConsts[name];
    else if (/^params\.length/.test(name)) sql += "1";
    else sql += " ";
  });
  return sql;
}

const stmts = [];
let skipped = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const t of templates(src)) {
    const raw = t.parts.map((p) => p.text).join("");
    if (!SQLISH.test(raw)) continue;
    const line = src.slice(0, t.at).split("\n").length;
    const sql = fill(t, f);
    // a fragment (a lone JOIN, a WHERE clause) is only meaningful inside a statement; skip it
    if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(sql)) { skipped++; continue; }
    stmts.push({ file: path.relative(process.cwd(), f), line, sql });
  }
}

const conn = await mysql.createConnection({
  socketPath: process.env.MARIA_SOCKET ?? "/tmp/mysql.sock",
  user: process.env.MARIA_USER ?? process.env.USER,
  password: process.env.MARIA_PASSWORD,
  database: process.env.MARIA_DB ?? "fp_maria",
});
await conn.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',PIPES_AS_CONCAT,ANSI_QUOTES')");

const results = { ok: 0, compileFail: [], prepareFail: [], dateWarnings: [] };
for (const s of stmts) {
  let out;
  try {
    const before = warnings.length;
    out = bind(compile(s.sql), Array.from({ length: 40 }, () => ["x"])); // arrays satisfy both ANY lists and JSON scalars
    for (const w of warnings.slice(before)) results.dateWarnings.push({ file: s.file, line: s.line, w });
  } catch (e) {
    results.compileFail.push({ ...s, err: e.message });
    continue;
  }
  try {
    const st = await conn.prepare(out.sql);
    st.close();
    results.ok++;
  } catch (e) {
    results.prepareFail.push({ ...s, err: e.message.slice(0, 200), out: out.sql });
  }
}

console.log(`(skipped ${skipped} fragments)  statements: ${stmts.length}  ok: ${results.ok}  compile errors: ${results.compileFail.length}  prepare errors: ${results.prepareFail.length}`);
const group = (list) => {
  const g = {};
  for (const r of list) {
    const near = r.err.match(/near '([^']{0,40})/);
    const key = near ? "SYNTAX near: " + near[1].split(/\s+/).slice(0, 3).join(" ") : r.err.replace(/'[^']*'/g, "'…'").replace(/line \d+/g, "line N").slice(0, 110);
    (g[key] ??= []).push(r);
  }
  return Object.entries(g).sort((a, b) => b[1].length - a[1].length);
};
for (const [label, list] of [["COMPILE", results.compileFail], ["PREPARE", results.prepareFail]]) {
  for (const [err, rs] of group(list)) {
    console.log(`\n[${label}] ${rs.length}x  ${err}`);
    for (const r of rs.slice(0, verbose ? 50 : 3)) console.log(`   ${r.file}:${r.line}`);
  }
}
if (results.dateWarnings.length) {
  console.log(`\n[DATE ARITHMETIC NOT REWRITTEN] ${results.dateWarnings.length}`);
  for (const w of results.dateWarnings) console.log(`   ${w.file}:${w.line}  ${w.w}`);
}
if (verbose) fs.writeFileSync("/tmp/check-sql-failures.json", JSON.stringify(results, null, 2));
await conn.end();
