import "server-only";
import { one, query } from "./db";
import { today } from "./format";
import { WEEK_OFF_KEY, parseWeekOff, isWeekOff } from "./week";

/** Statuses a teacher may only award on the day itself. */
export const SAME_DAY_ONLY = new Set(["present", "late", "half_day"]);
/** What can still be recorded once the day has passed. */
export const PAST_DAY_ALLOWED = new Set(["absent", "leave"]);

export const AUTO_ABSENT_REMARK = "Auto-marked absent — register not filled that day";

/** How far back a close-out will ever reach, so a long gap can't stall a page load. */
const MAX_BACKFILL_DAYS = 60;
const LAST_CLOSED_KEY = "attendance.last_closed_date";

async function setting(key: string, fallback: string) {
  const row = await one<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [key]);
  return row?.value ?? fallback;
}

/** The weekly days off, as the super admin has them set. */
export async function weekOffDays(): Promise<number[]> {
  const row = await one<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = $1", [WEEK_OFF_KEY]);
  return parseWeekOff(row?.value);
}

async function putSetting(key: string, value: string) {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1,$2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Closes every past day that was left unmarked: each active student without a row
 * for that date is recorded absent. Runs at most once per day — the last closed date
 * is kept in app_settings, so repeat calls are a single cheap read.
 */
export async function closeRegisterUpToYesterday(): Promise<number> {
  const yesterday = addDays(today(), -1);
  const weekOff = await weekOffDays();

  const earliest = addDays(today(), -MAX_BACKFILL_DAYS);
  let cursor = await setting(LAST_CLOSED_KEY, "");
  if (!cursor || cursor < earliest) cursor = earliest;
  if (cursor >= yesterday) return 0;

  let filled = 0;
  let day = addDays(cursor, 1);
  while (day <= yesterday) {
    if (!isWeekOff(day, weekOff)) {
      const rows = await query<{ id: number }>(
        `INSERT INTO student_attendance
           (student_id, enrollment_id, session_id, class_level_id, center_id,
            att_date, status, remarks)
         SELECT e.student_id, e.id, e.session_id, e.class_level_id, e.center_id,
                $1::date, 'absent', $2
           FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN academic_sessions a ON a.id = e.session_id
          WHERE e.status = 'active' AND s.status = 'active'
            AND $1::date >= e.enrolled_on
            AND $1::date BETWEEN a.start_date AND a.end_date
            AND NOT EXISTS (
              SELECT 1 FROM student_attendance x
               WHERE x.student_id = e.student_id AND x.att_date = $1::date)
            -- a holiday or closure on the calendar is not an absence
            AND NOT EXISTS (
              SELECT 1 FROM calendar_events ce
               WHERE ce.affects_attendance
                 AND $1::date BETWEEN ce.start_date AND ce.end_date
                 AND (ce.center_id IS NULL OR ce.center_id = e.center_id))
         ON CONFLICT (student_id, att_date) DO NOTHING
         RETURNING id`,
        [day, AUTO_ABSENT_REMARK],
      );
      filled += rows.length;
    }
    day = addDays(day, 1);
  }

  await putSetting(LAST_CLOSED_KEY, yesterday);
  return filled;
}
