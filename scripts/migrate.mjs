import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
const dir = path.join(process.cwd(), "db", "migrations");

const client = await pool.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) { console.log(`· skip   ${file}`); continue; }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ apply  ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ failed ${file}\n${err.message}`);
      process.exit(1);
    }
  }
  console.log("Migrations up to date.");
} finally {
  client.release();
  await pool.end();
}
