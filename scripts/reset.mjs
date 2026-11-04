/**
 * Wipes every record so you can go live with real data.
 * Guard: run with CONFIRM_RESET=yes, e.g.
 *   CONFIRM_RESET=yes node --env-file=.env.local scripts/reset.mjs
 * Keeps the schema (and the list of applied migrations); re-run `npm run seed` afterwards
 * to recreate the admin login.
 */
import { connect } from "./db-connect.mjs";

if (process.env.CONFIRM_RESET !== "yes") {
  console.error("Refusing to run. Set CONFIRM_RESET=yes to wipe all data.");
  process.exit(1);
}
const db = await connect();
try {
  const [tables] = await db.query(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'");
  await db.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const { t } of tables) await db.query(`TRUNCATE TABLE \`${t}\``);   // also restarts the id counters
  await db.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log(`All data cleared from ${tables.length} tables. Run \`npm run seed\` to recreate the admin login.`);
} finally {
  await db.end();
}
