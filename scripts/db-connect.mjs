/**
 * Shared by migrate/seed/reset: opens a MariaDB connection from DATABASE_URL, e.g.
 *   mysql://user:password@127.0.0.1:3306/database
 * (a local test database can add ?socket=/path/to/mysql.sock).
 */
import mysql from "mysql2/promise";

export async function connect({ multipleStatements = false } = {}) {
  const raw = process.env.DATABASE_URL;
  if (!raw) { console.error("DATABASE_URL is not set"); process.exit(1); }
  const u = new URL(raw);
  if (!/^mysql/.test(u.protocol)) {
    console.error("DATABASE_URL must be a mysql:// address (this app now runs on MariaDB).");
    process.exit(1);
  }
  return mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    socketPath: u.searchParams.get("socket") ?? undefined,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: false } : undefined,
    charset: "UTF8MB4_BIN",
    multipleStatements,
    dateStrings: ["DATE"],
  });
}
