import "server-only";
import { one, query } from "./db";

/**
 * What the register adds up to.
 *
 * Every query takes the centre in view and the session, because a teacher
 * reads this page for their own centre and an administrator for all of them,
 * and the same query answers both — the centre is simply always set for a
 * teacher.
 */

/** The headline: today, and the period behind it. */
export function attendanceHeadline(
  sessionId: number, centerId: number | null, from: string, to: string, today: string,
) {
  const args: unknown[] = [sessionId, from, to, today];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  return one<{
    marked_today: number; present_today: number; absent_today: number;
    roll: number; days: number; present: number; absent: number; pct: number | null;
  }>(
    `SELECT count(*) FILTER (WHERE a.att_date = $4)::int                          AS marked_today,
            count(*) FILTER (WHERE a.att_date = $4 AND a.status = 'present')::int AS present_today,
            count(*) FILTER (WHERE a.att_date = $4 AND a.status = 'absent')::int  AS absent_today,
            (SELECT count(*) FROM enrollments e
               JOIN students s ON s.id = e.student_id
              WHERE e.session_id = $1 AND e.status = 'active' AND s.status = 'active'
                ${centerId ? `AND e.center_id = $${args.length}` : ""})::int      AS roll,
            count(DISTINCT a.att_date)::int                                       AS days,
            count(*) FILTER (WHERE a.status = 'present')::int                     AS present,
            count(*) FILTER (WHERE a.status = 'absent')::int                      AS absent,
            round(100.0 * count(*) FILTER (WHERE a.status = 'present')
                  / NULLIF(count(*), 0))::int                                     AS pct
       FROM student_attendance a
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${c}`,
    args);
}

/** Day by day: present against absent, for the bars across the top. */
export function attendanceByDay(
  sessionId: number, centerId: number | null, from: string, to: string,
) {
  const args: unknown[] = [sessionId, from, to];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  return query<{ day: string; present: number; absent: number; pct: number | null }>(
    `SELECT to_char(a.att_date, 'YYYY-MM-DD') AS day,
            count(*) FILTER (WHERE a.status = 'present')::int AS present,
            count(*) FILTER (WHERE a.status = 'absent')::int  AS absent,
            round(100.0 * count(*) FILTER (WHERE a.status = 'present')
                  / NULLIF(count(*), 0))::int AS pct
       FROM student_attendance a
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${c}
      GROUP BY a.att_date ORDER BY a.att_date`,
    args);
}

/** Why children were away — the whole point of asking for a reason. */
export function absenceReasons(
  sessionId: number, centerId: number | null, from: string, to: string,
) {
  const args: unknown[] = [sessionId, from, to];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  return query<{ reason: string; n: number; children: number; centres: number }>(
    `SELECT COALESCE(a.reason, 'No reason given') AS reason,
            count(*)::int AS n,
            count(DISTINCT a.student_id)::int AS children,
            count(DISTINCT a.center_id)::int AS centres
       FROM student_attendance a
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3
        AND a.status IN ('absent', 'leave') ${c}
      GROUP BY 1 ORDER BY 2 DESC`,
    args);
}

/** Centre by centre, for an administrator reading the whole organisation. */
export function attendanceByCentre(
  sessionId: number, centerId: number | null, from: string, to: string,
) {
  const args: unknown[] = [sessionId, from, to];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  return query<{
    center_name: string; roll: number; present: number; absent: number;
    pct: number | null; days: number;
  }>(
    `SELECT ce.name AS center_name,
            (SELECT count(*) FROM enrollments e
               JOIN students s ON s.id = e.student_id
              WHERE e.center_id = ce.id AND e.session_id = $1
                AND e.status = 'active' AND s.status = 'active')::int AS roll,
            count(*) FILTER (WHERE a.status = 'present')::int AS present,
            count(*) FILTER (WHERE a.status = 'absent')::int  AS absent,
            round(100.0 * count(*) FILTER (WHERE a.status = 'present')
                  / NULLIF(count(*), 0))::int AS pct,
            count(DISTINCT a.att_date)::int AS days
       FROM student_attendance a
       JOIN centers ce ON ce.id = a.center_id
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${c}
      GROUP BY ce.id, ce.code, ce.name
      ORDER BY pct ASC NULLS LAST, ce.code`,
    args);
}

/** Class by class — where in the school the absence sits. */
export function attendanceByClass(
  sessionId: number, centerId: number | null, from: string, to: string,
) {
  const args: unknown[] = [sessionId, from, to];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  return query<{ class_name: string; present: number; absent: number; pct: number | null }>(
    `SELECT cl.name AS class_name,
            count(*) FILTER (WHERE a.status = 'present')::int AS present,
            count(*) FILTER (WHERE a.status = 'absent')::int  AS absent,
            round(100.0 * count(*) FILTER (WHERE a.status = 'present')
                  / NULLIF(count(*), 0))::int AS pct
       FROM student_attendance a
       JOIN class_levels cl ON cl.id = a.class_level_id
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${c}
      GROUP BY cl.id, cl.sequence, cl.name ORDER BY cl.sequence`,
    args);
}

/**
 * The children the register is really about: those missing the most days.
 * Their reasons come with them, because "away eleven days, all sick" and
 * "away eleven days, nobody knows why" are different problems.
 */
export function mostAbsent(
  sessionId: number, centerId: number | null, from: string, to: string, limit = 12,
) {
  const args: unknown[] = [sessionId, from, to];
  const c = centerId ? ` AND a.center_id = $${args.push(centerId)}` : "";
  args.push(limit);
  return query<{
    student_id: number; student: string; enrollment_no: string;
    center_name: string; class_name: string | null;
    days_absent: number; days_marked: number; pct: number | null; reasons: string | null;
    flag_status: string | null; flag_urgency: string | null; flag_on: string | null;
  }>(
    `SELECT s.id AS student_id,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, ce.name AS center_name, cl.name AS class_name,
            count(*) FILTER (WHERE a.status = 'absent')::int AS days_absent,
            count(*)::int AS days_marked,
            round(100.0 * count(*) FILTER (WHERE a.status = 'present')
                  / NULLIF(count(*), 0))::int AS pct,
            (SELECT string_agg(x.reason || ' ×' || x.n, ', ' ORDER BY x.n DESC)
               FROM (SELECT b.reason, count(*)::int AS n
                       FROM student_attendance b
                      WHERE b.student_id = s.id AND b.att_date BETWEEN $2 AND $3
                        AND b.reason IS NOT NULL
                      GROUP BY b.reason ORDER BY count(*) DESC LIMIT 3) x) AS reasons,
            cf.status AS flag_status, cf.urgency AS flag_urgency, cf.raised_on AS flag_on
       FROM student_attendance a
       JOIN students s ON s.id = a.student_id
       JOIN centers ce ON ce.id = a.center_id
       LEFT JOIN class_levels cl ON cl.id = a.class_level_id
       LEFT JOIN counselling_flags cf ON cf.student_id = s.id AND cf.status <> 'closed'
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${c}
      GROUP BY s.id, s.first_name, s.last_name, s.enrollment_no, ce.name, cl.name,
               cf.status, cf.urgency, cf.raised_on
     HAVING count(*) FILTER (WHERE a.status = 'absent') > 0
      ORDER BY count(*) FILTER (WHERE a.status = 'absent') DESC, s.first_name
      LIMIT $${args.length}`,
    args);
}

/** Registers nobody has filled in today — the day's chase list. */
export function unmarkedToday(sessionId: number, centerId: number | null, day: string) {
  const args: unknown[] = [sessionId, day];
  const c = centerId ? ` AND e.center_id = $${args.push(centerId)}` : "";
  return query<{ center_name: string; class_name: string; children: number }>(
    `SELECT ce.name AS center_name, cl.name AS class_name, count(*)::int AS children
       FROM enrollments e
       JOIN students s ON s.id = e.student_id AND s.status = 'active'
       JOIN centers ce ON ce.id = e.center_id
       JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE e.session_id = $1 AND e.status = 'active' ${c}
        AND NOT EXISTS (SELECT 1 FROM student_attendance a
                         WHERE a.student_id = s.id AND a.att_date = $2)
      GROUP BY ce.id, ce.code, ce.name, cl.sequence, cl.name
      ORDER BY ce.code, cl.sequence`,
    args);
}
