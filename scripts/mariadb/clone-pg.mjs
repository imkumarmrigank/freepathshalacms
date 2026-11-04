/**
 * Makes a frozen, local PostgreSQL copy of the live database (structure and data, no photo
 * files), so the original app and the MariaDB app can be compared on identical data.
 *
 *   SOURCE_URL=postgres://neon...  TARGET_URL=postgres://localhost/fp_snap  node scripts/mariadb/clone-pg.mjs
 */
import pg from "pg";
import { connect, loadModel } from "./introspect.mjs";

const SOURCE = process.env.SOURCE_URL, TARGET = process.env.TARGET_URL;
if (!SOURCE || !TARGET) { console.error("Set SOURCE_URL and TARGET_URL."); process.exit(2); }

pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => v);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => v);

const src = connect(SOURCE);
src.on("connect", (c) => c.query("SET TIME ZONE 'UTC'"));
const dst = new pg.Pool({ connectionString: TARGET, max: 1 });
dst.on("connect", (c) => c.query("SET TIME ZONE 'UTC'"));

const model = await loadModel(src);
const tables = Object.keys(model).sort();
const id = (s) => '"' + s + '"';

await dst.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

for (const name of tables) {
  const t = model[name];
  const cols = t.columns.map((c) => `${id(c.col)} ${c.fmt}${c.notnull ? " NOT NULL" : ""}`).join(", ");
  await dst.query(`CREATE TABLE ${id(name)} (${cols})`);
}

for (const name of tables) {
  const t = model[name];
  const cols = t.columns;
  let offset = 0;
  const sel = cols.map((c) => (name === "media" && c.col === "bytes" ? `'\\x'::bytea AS ${id(c.col)}` : id(c.col))).join(", ");
  const pk = t.constraints.find((k) => k.type === "p");
  for (;;) {
    const { rows } = await src.query(`SELECT ${sel} FROM ${id(name)} ${pk ? "ORDER BY " + pk.cols.map(id).join(", ") : ""} LIMIT 2000 OFFSET ${offset}`);
    if (!rows.length) break;
    const json = rows.map((r) => {
      const o = {};
      for (const c of cols) { const v = r[c.col]; o[c.col] = Buffer.isBuffer(v) ? "\\x" + v.toString("hex") : v; }
      return o;
    });
    await dst.query(`INSERT INTO ${id(name)} SELECT * FROM json_populate_recordset(NULL::${id(name)}, $1::json)`, [JSON.stringify(json)]);
    offset += rows.length;
    if (rows.length < 2000) break;
  }
}

// constraints last, so load order does not matter
for (const name of tables) {
  for (const k of model[name].constraints.filter((k) => k.type !== "f")) {
    await dst.query(`ALTER TABLE ${id(name)} ADD CONSTRAINT ${id(k.name)} ${k.def}`);
  }
}
for (const name of tables) {
  for (const k of model[name].constraints.filter((k) => k.type === "f")) {
    await dst.query(`ALTER TABLE ${id(name)} ADD CONSTRAINT ${id(k.name)} ${k.def} NOT VALID`);
  }
}
const n = (await dst.query("SELECT count(*) FROM students")).rows[0].count;
console.log(`cloned ${tables.length} tables; students: ${n}`);
await src.end(); await dst.end();
