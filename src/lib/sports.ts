import "server-only";
import { one, query } from "./db";
import type { Player } from "./sports-meta";

export type SportSummary = {
  id: number; name: string; description: string | null; is_active: boolean;
  players: number; special: number; tests: number; last_session: string | null;
};

/** Every game played at a centre, with how many children are in it. */
export function sportsAt(centerId: number) {
  return query<SportSummary>(
    `SELECT sp.id, sp.name, sp.description, sp.is_active,
            (SELECT count(*) FROM sport_students ss
              WHERE ss.sport_id = sp.id AND ss.left_on IS NULL)::int           AS players,
            (SELECT count(*) FROM sport_students ss
              WHERE ss.sport_id = sp.id AND ss.left_on IS NULL
                AND ss.is_special)::int                                        AS special,
            (SELECT count(*) FROM sport_tests t WHERE t.sport_id = sp.id)::int AS tests,
            (SELECT max(att_date) FROM sport_attendance a WHERE a.sport_id = sp.id) AS last_session
       FROM sports sp
      WHERE sp.center_id = $1
      ORDER BY sp.is_active DESC, lower(sp.name)`,
    [centerId],
  );
}

export function sportById(id: number) {
  return one<{
    id: number; name: string; description: string | null; is_active: boolean;
    center_id: number; center_name: string; center_code: string;
  }>(
    `SELECT sp.id, sp.name, sp.description, sp.is_active, sp.center_id,
            c.name AS center_name, c.code AS center_code
       FROM sports sp JOIN centers c ON c.id = sp.center_id
      WHERE sp.id = $1`,
    [id],
  );
}

/**
 * The children currently in a sport. Class is read from the current session's
 * enrolment, so a child promoted in April shows their new class here too.
 */
export function playersOf(sportId: number, sessionId: number) {
  return query<Player>(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.enrollment_no, s.gender,
            cl.name AS class_name, ss.joined_on, ss.is_special, ss.speciality,
            ss.special_level
       FROM sport_students ss
       JOIN students s ON s.id = ss.student_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $2
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE ss.sport_id = $1 AND ss.left_on IS NULL AND s.status = 'active'
      ORDER BY cl.sequence NULLS LAST, s.first_name, s.last_name`,
    [sportId, sessionId],
  );
}

/** Children at the centre who could join: on the roll and not already playing. */
export function candidatesFor(sportId: number, centerId: number, sessionId: number) {
  return query<{
    student_id: number; first_name: string; last_name: string | null;
    enrollment_no: string; class_name: string | null; gender: string | null;
  }>(
    `SELECT s.id AS student_id, s.first_name, s.last_name, s.enrollment_no,
            cl.name AS class_name, s.gender
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE e.center_id = $2 AND e.session_id = $3
        AND e.status = 'active' AND s.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM sport_students ss
                         WHERE ss.sport_id = $1 AND ss.student_id = s.id
                           AND ss.left_on IS NULL)
      ORDER BY cl.sequence, s.first_name, s.last_name`,
    [sportId, centerId, sessionId],
  );
}

/** What the sports register holds for a day. */
export async function attendanceOn(sportId: number, date: string) {
  const rows = await query<{ student_id: number; status: string }>(
    "SELECT student_id, status FROM sport_attendance WHERE sport_id = $1 AND att_date = $2",
    [sportId, date],
  );
  return Object.fromEntries(rows.map((r) => [r.student_id, r.status])) as Record<number, string>;
}

export function testsOf(sportId: number) {
  return query<{
    id: number; title: string; test_date: string; max_marks: string;
    marked: number; average: string | null;
  }>(
    `SELECT t.id, t.title, t.test_date, t.max_marks,
            count(m.id) FILTER (WHERE m.marks IS NOT NULL OR m.is_absent)::int AS marked,
            round(avg(m.marks), 1) AS average
       FROM sport_tests t
       LEFT JOIN sport_marks m ON m.test_id = t.id
      WHERE t.sport_id = $1
      GROUP BY t.id
      ORDER BY t.test_date DESC, t.id DESC`,
    [sportId],
  );
}

export function testById(id: number) {
  return one<{
    id: number; sport_id: number; title: string; test_date: string; max_marks: string;
  }>("SELECT id, sport_id, title, test_date, max_marks FROM sport_tests WHERE id = $1", [id]);
}

export async function marksFor(testId: number) {
  const rows = await query<{
    student_id: number; marks: string | null; is_absent: boolean; remarks: string | null;
  }>("SELECT student_id, marks, is_absent, remarks FROM sport_marks WHERE test_id = $1", [testId]);
  return Object.fromEntries(rows.map((r) => [r.student_id, r]));
}

/** Present/absent counts per child, for the talent tab and the reports. */
export async function turnout(sportId: number) {
  const rows = await query<{ student_id: number; present: number; marked: number }>(
    `SELECT student_id,
            count(*) FILTER (WHERE status = 'present')::int AS present,
            count(*)::int AS marked
       FROM sport_attendance WHERE sport_id = $1 GROUP BY student_id`,
    [sportId],
  );
  return Object.fromEntries(rows.map((r) => [r.student_id, r]));
}

/* ---------------------------------------------------- the teacher's visits */

export type Visit = {
  id: number; center_id: number; center_name: string; center_code: string;
  visit_date: string; check_in_at: string; check_out_at: string | null;
  check_in_distance_m: number | null; worked_minutes: number | null;
  sports_covered: string[]; children_count: number | null; activities: string | null;
  highlights: string | null; issues: string | null; report_submitted_at: string | null;
  closed_late: boolean;
};

const VISIT = `
  SELECT v.id, v.center_id, c.name AS center_name, c.code AS center_code,
         v.visit_date, v.check_in_at, v.check_out_at, v.check_in_distance_m,
         v.worked_minutes, v.sports_covered, v.children_count, v.activities,
         v.highlights, v.issues, v.report_submitted_at, v.closed_late
    FROM sports_visits v JOIN centers c ON c.id = v.center_id`;

/** The visit still waiting for its report, wherever it is. */
export function openVisit(userId: number) {
  return one<Visit>(`${VISIT} WHERE v.user_id = $1 AND v.report_submitted_at IS NULL`, [userId]);
}

/** Every centre visited on a day, in the order they were reached. */
export function visitsOn(userId: number, date: string) {
  return query<Visit>(`${VISIT} WHERE v.user_id = $1 AND v.visit_date = $2 ORDER BY v.check_in_at`,
    [userId, date]);
}
