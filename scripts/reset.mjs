/**
 * Wipes every record so you can go live with real data.
 * Guard: run with CONFIRM_RESET=yes, e.g.
 *   CONFIRM_RESET=yes node --env-file=.env.local scripts/reset.mjs
 * Keeps the schema; re-run `npm run seed` afterwards to recreate the admin login.
 */
import pg from "pg";

if (process.env.CONFIRM_RESET !== "yes") {
  console.error("Refusing to run. Set CONFIRM_RESET=yes to wipe all data.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2 });
await pool.query(`TRUNCATE
  ptm_interactions, ptm_meetings, student_attendance, staff_attendance,
  promotion_runs, teacher_classes, enrollments, enrollment_counters,
  students, users, centers, academic_sessions, class_levels, app_settings
  RESTART IDENTITY CASCADE`);
console.log("All data cleared. Run `npm run seed` to recreate the admin login.");
await pool.end();
