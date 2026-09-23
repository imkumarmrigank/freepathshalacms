import "server-only";
import { one, query } from "./db";

/**
 * The office's headline: what sport is happening, and how much of it.
 *
 * With a sports teacher chosen, the work counts are theirs — their visits,
 * the registers they marked, the tests they set. What exists at the centres
 * — the sports and the children in them — is the same whoever is asked.
 */
export function sportsHeadline(
  from: string, to: string, teacherId: number | null, centerId: number | null,
) {
  const args: unknown[] = [from, to];
  if (teacherId) args.push(teacherId);
  const t = teacherId ? `AND $${args.length}` : "";
  if (centerId) args.push(centerId);
  const c = centerId ? `$${args.length}` : null;
  const mine = (col: string) => (t ? `AND ${col} = ${t.slice(4)}` : "");
  const atCentre = (sportCol: string) =>
    c ? `AND ${sportCol} IN (SELECT id FROM sports WHERE center_id = ${c})` : "";
  const centreOnly = c ? `AND center_id = ${c}` : "";
  return one<{
    sports: string; centres: string; players: string; special: string;
    sessions: string; present: string; marked: string; tests: string; visits: string;
  }>(
    `SELECT
       (SELECT count(*) FROM sports WHERE is_active ${centreOnly})                AS sports,
       (SELECT count(DISTINCT center_id) FROM sports WHERE is_active ${centreOnly}) AS centres,
       (SELECT count(DISTINCT ss.student_id) FROM sport_students ss
          JOIN sports sp ON sp.id = ss.sport_id
         WHERE ss.left_on IS NULL AND sp.is_active ${c ? `AND sp.center_id = ${c}` : ""}) AS players,
       (SELECT count(*) FROM sport_students ss JOIN sports sp ON sp.id = ss.sport_id
         WHERE ss.left_on IS NULL AND sp.is_active AND ss.is_special
           ${c ? `AND sp.center_id = ${c}` : ""})                                 AS special,
       (SELECT count(DISTINCT (a.sport_id, a.att_date)) FROM sport_attendance a
         WHERE a.att_date BETWEEN $1 AND $2 ${mine("a.marked_by")} ${atCentre("a.sport_id")}) AS sessions,
       (SELECT count(*) FROM sport_attendance a
         WHERE a.att_date BETWEEN $1 AND $2 AND a.status = 'present'
           ${mine("a.marked_by")} ${atCentre("a.sport_id")})                      AS present,
       (SELECT count(*) FROM sport_attendance a
         WHERE a.att_date BETWEEN $1 AND $2 ${mine("a.marked_by")} ${atCentre("a.sport_id")}) AS marked,
       (SELECT count(*) FROM sport_tests t
         WHERE t.test_date BETWEEN $1 AND $2 ${mine("t.created_by")} ${atCentre("t.sport_id")}) AS tests,
       (SELECT count(*) FROM sports_visits v
         WHERE v.visit_date BETWEEN $1 AND $2 ${mine("v.user_id")} ${c ? `AND v.center_id = ${c}` : ""}) AS visits`,
    args);
}

/** Every sport, where it runs and how it is going. */
export function sportsRundown(
  from: string, to: string, teacherId: number | null, centerId: number | null,
) {
  const args: unknown[] = [from, to];
  if (teacherId) args.push(teacherId);
  const t = teacherId ? `$${args.length}` : null;
  if (centerId) args.push(centerId);
  const mine = (col: string) => (t ? `AND ${col} = ${t}` : "");
  const where = centerId ? `WHERE sp.center_id = $${args.length}` : "";
  return query<{
    id: number; sport: string; center_name: string; is_active: boolean;
    players: number; special: number; sessions: number; present: number; marked: number;
    tests: number; last_session: string | null;
  }>(
    `SELECT sp.id, sp.name AS sport, c.name AS center_name, sp.is_active,
            (SELECT count(*) FROM sport_students ss
              WHERE ss.sport_id = sp.id AND ss.left_on IS NULL)::int        AS players,
            (SELECT count(*) FROM sport_students ss
              WHERE ss.sport_id = sp.id AND ss.left_on IS NULL AND ss.is_special)::int AS special,
            (SELECT count(DISTINCT a.att_date) FROM sport_attendance a
              WHERE a.sport_id = sp.id AND a.att_date BETWEEN $1 AND $2
                ${mine("a.marked_by")})::int                               AS sessions,
            (SELECT count(*) FROM sport_attendance a
              WHERE a.sport_id = sp.id AND a.att_date BETWEEN $1 AND $2
                AND a.status = 'present' ${mine("a.marked_by")})::int       AS present,
            (SELECT count(*) FROM sport_attendance a
              WHERE a.sport_id = sp.id AND a.att_date BETWEEN $1 AND $2
                ${mine("a.marked_by")})::int                                AS marked,
            (SELECT count(*) FROM sport_tests t
              WHERE t.sport_id = sp.id AND t.test_date BETWEEN $1 AND $2
                ${mine("t.created_by")})::int                               AS tests,
            to_char((SELECT max(a.att_date) FROM sport_attendance a
                      WHERE a.sport_id = sp.id), 'YYYY-MM-DD')              AS last_session
       FROM sports sp JOIN centers c ON c.id = sp.center_id
      ${where}
      ORDER BY sp.is_active DESC, c.code, lower(sp.name)`,
    args);
}

/** The sports teacher's own days: where they went and what they reported. */
export function sportsTeacherDays(from: string, to: string, teacherId: number | null) {
  return query<{
    user_id: number; teacher: string; days: number; visits: number; centres: number;
    minutes: number | null; children: number | null; pending: number; last_visit: string | null;
  }>(
    `SELECT u.id AS user_id, u.name AS teacher,
            count(DISTINCT v.visit_date)::int                       AS days,
            count(v.id)::int                                        AS visits,
            count(DISTINCT v.center_id)::int                        AS centres,
            sum(v.worked_minutes)::int                              AS minutes,
            sum(v.children_count)::int                              AS children,
            count(*) FILTER (WHERE v.report_submitted_at IS NULL)::int AS pending,
            to_char(max(v.visit_date), 'YYYY-MM-DD')                AS last_visit
       FROM users u
       LEFT JOIN sports_visits v ON v.user_id = u.id AND v.visit_date BETWEEN $1 AND $2
      WHERE u.role = 'sports_teacher' ${teacherId ? "AND u.id = $3" : ""}
      GROUP BY u.id, u.name
      ORDER BY count(v.id) DESC, u.name`,
    teacherId ? [from, to, teacherId] : [from, to]);
}

/** Today's — or a chosen day's — visits, as the reports left them. */
export function sportsVisitsOn(day: string, teacherId: number | null, centerId: number | null) {
  const args: unknown[] = [day];
  if (teacherId) args.push(teacherId);
  const t = teacherId ? `AND v.user_id = $${args.length}` : "";
  if (centerId) args.push(centerId);
  const c = centerId ? `AND v.center_id = $${args.length}` : "";
  return query<{
    id: number; teacher: string; center_name: string; check_in: string; check_out: string | null;
    minutes: number | null; sports_covered: string[]; children_count: number | null;
    activities: string | null; issues: string | null; submitted: boolean;
  }>(
    `SELECT v.id, u.name AS teacher, c.name AS center_name,
            to_char(v.check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')  AS check_in,
            to_char(v.check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS check_out,
            v.worked_minutes, v.sports_covered, v.children_count, v.activities, v.issues,
            (v.report_submitted_at IS NOT NULL) AS submitted
       FROM sports_visits v
       JOIN users u ON u.id = v.user_id
       JOIN centers c ON c.id = v.center_id
      WHERE v.visit_date = $1 ${t} ${c}
      ORDER BY v.check_in_at`,
    args);
}

/** Turnout day by day, across every sport. */
export function sportsTurnout(
  from: string, to: string, teacherId: number | null, centerId: number | null,
) {
  const args: unknown[] = [from, to];
  if (teacherId) args.push(teacherId);
  const t = teacherId ? `AND a.marked_by = $${args.length}` : "";
  if (centerId) args.push(centerId);
  const c = centerId
    ? `AND a.sport_id IN (SELECT id FROM sports WHERE center_id = $${args.length})` : "";
  return query<{ day: string; present: number; marked: number }>(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
            count(a.id) FILTER (WHERE a.status = 'present')::int AS present,
            count(a.id)::int AS marked
       FROM generate_series($1::date, $2::date, interval '1 day') d
       LEFT JOIN sport_attendance a ON a.att_date = d::date ${t} ${c}
      GROUP BY d ORDER BY d`,
    args);
}

/** The children an office should know about: the gifted ones. */
export function sportsTalentList(centerId: number | null, limit = 20) {
  return query<{
    student_id: number; student: string; enrollment_no: string; center_name: string;
    sport: string; speciality: string | null; special_level: string | null;
    present: number; marked: number;
  }>(
    `SELECT s.id AS student_id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, c.name AS center_name, sp.name AS sport,
            ss.speciality, ss.special_level,
            (SELECT count(*) FROM sport_attendance a
              WHERE a.sport_id = ss.sport_id AND a.student_id = ss.student_id
                AND a.status = 'present')::int AS present,
            (SELECT count(*) FROM sport_attendance a
              WHERE a.sport_id = ss.sport_id AND a.student_id = ss.student_id)::int AS marked
       FROM sport_students ss
       JOIN sports sp ON sp.id = ss.sport_id
       JOIN centers c ON c.id = sp.center_id
       JOIN students s ON s.id = ss.student_id
      WHERE ss.is_special AND ss.left_on IS NULL
        ${centerId ? "AND sp.center_id = $1" : ""}
      ORDER BY array_position(ARRAY['national','state','district','centre'], ss.special_level),
               c.code, student
      LIMIT ${limit}`,
    centerId ? [centerId] : []);
}

/** The sports teachers, for the office's "whose work?" picker. */
export function sportsTeachers() {
  return query<{ id: number; name: string }>(
    `SELECT id, name FROM users WHERE role = 'sports_teacher' ORDER BY is_active DESC, name`);
}
