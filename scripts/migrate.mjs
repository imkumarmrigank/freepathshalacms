/**
 * Brings a MariaDB database up to date.
 *
 *  - An empty database gets the baseline first: db/mariadb/schema.sql, foreign-keys.sql and
 *    triggers.sql (together they are the whole schema as of the move from PostgreSQL).
 *  - Then every file in db/mariadb/migrations/ that has not been applied yet, in name order.
 *    Name new ones 001_what_it_does.sql, 002_..., and write them in MariaDB SQL.
 *
 * MariaDB cannot roll back schema changes, so a migration that fails half way leaves what it
 * already did in place: keep each file small, and fix forward with a new file.
 * (db/migrations/ holds the old PostgreSQL history; it is kept for reference only.)
 */
import fs from "node:fs";
import path from "node:path";
import { connect } from "./db-connect.mjs";

const root = path.join(process.cwd(), "db", "mariadb");
const db = await connect({ multipleStatements: true });

/** Files that define triggers separate statements with a line holding only // */
const parts = (sql) => (sql.includes("\n//") ? sql.split(/^\/\/\s*$/m).map((s) => s.trim()).filter(Boolean) : [sql]);

async function runFile(file) {
  const sql = fs.readFileSync(file, "utf8");
  for (const piece of parts(sql)) await db.query(piece);
}

try {
  const [[has]] = await db.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'students'");
  if (Number(has.n) === 0) {
    console.log("Empty database: creating the baseline schema ...");
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    await runFile(path.join(root, "schema.sql"));
    await runFile(path.join(root, "foreign-keys.sql"));
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
    await runFile(path.join(root, "triggers.sql"));
    await db.query("INSERT IGNORE INTO schema_migrations (filename) VALUES ('baseline-mariadb')");
    console.log("✓ baseline");
  } else {
    await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) NOT NULL PRIMARY KEY, applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))");
  }

  const [rows] = await db.query("SELECT filename FROM schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const dir = path.join(root, "migrations");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort() : [];

  for (const file of files) {
    if (done.has(file)) { console.log(`· skip   ${file}`); continue; }
    try {
      await runFile(path.join(dir, file));
      await db.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      console.log(`✓ apply  ${file}`);
    } catch (err) {
      console.error(`✗ failed ${file}\n${err.message}`);
      process.exit(1);
    }
  }
  console.log("Migrations up to date.");
} finally {
  await db.end();
}
