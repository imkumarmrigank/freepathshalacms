import "server-only";
import { query } from "./db";

const scoped = (centerId: number | null, params: unknown[], col: string) => {
  if (centerId == null) return "";
  params.push(centerId);
  return ` AND ${col} = $${params.length}`;
};

/** Admissions per session — new versus joined mid-session. */
export async function admissionsBySession(centerId: number | null) {
  const params: unknown[] = [];
  const where = scoped(centerId, params, "e.center_id");
  return query<{ session: string; total: string; fresh: string; mid: string; promoted: string }>(
    `SELECT s.name AS session,
            count(*) FILTER (WHERE e.source IN ('new','mid_session','transfer')) AS total,
            count(*) FILTER (WHERE e.source = 'new') AS fresh,
            count(*) FILTER (WHERE e.source = 'mid_session') AS mid,
            count(*) FILTER (WHERE e.source = 'promoted') AS promoted
       FROM enrollments e
       JOIN academic_sessions s ON s.id = e.session_id
      WHERE 1=1 ${where}
      GROUP BY s.name, s.sequence ORDER BY s.sequence`,
    params,
  );
}

/** Admissions month by month inside one session. */
export async function admissionsByMonth(sessionId: number, centerId: number | null) {
  const params: unknown[] = [sessionId];
  const where = scoped(centerId, params, "e.center_id");
  return query<{ month: string; label: string; n: string }>(
    `SELECT to_char(e.enrolled_on, 'YYYY-MM') AS month,
            to_char(e.enrolled_on, 'Mon') AS label, count(*) AS n
       FROM enrollments e
      WHERE e.session_id = $1 AND e.source IN ('new','mid_session','transfer') ${where}
      GROUP BY 1, 2 ORDER BY 1`,
    params,
  );
}

/** What each promotion run did — the pass/progress picture, session by session. */
export async function promotionOutcomes(centerId: number | null) {
  const params: unknown[] = [];
  const where = centerId == null ? "" : (params.push(centerId), ` AND (r.center_id IS NULL OR r.center_id = $1)`);
  return query<{
    session: string; promoted: string; retained: string; graduated: string; skipped: string;
  }>(
    `SELECT f.name AS session,
            COALESCE(sum(r.promoted_count), 0)  AS promoted,
            COALESCE(sum(r.retained_count), 0)  AS retained,
            COALESCE(sum(r.graduated_count), 0) AS graduated,
            COALESCE(sum(r.skipped_count), 0)   AS skipped
       FROM promotion_runs r
       JOIN academic_sessions f ON f.id = r.from_session_id
      WHERE 1=1 ${where}
      GROUP BY f.name, f.sequence ORDER BY f.sequence`,
    params,
  );
}

/** Daily attendance percentage over a window. */
export async function attendanceDaily(sessionId: number, centerId: number | null, days: number) {
  const params: unknown[] = [sessionId, days];
  const where = scoped(centerId, params, "a.center_id");
  return query<{ day: string; label: string; present: string; marked: string }>(
    `SELECT a.att_date::text AS day, to_char(a.att_date, 'DD Mon') AS label,
            count(*) FILTER (WHERE a.status IN ('present','late','half_day')) AS present,
            count(*) FILTER (WHERE a.status <> 'holiday') AS marked
       FROM student_attendance a
      WHERE a.session_id = $1
        AND a.att_date > CURRENT_DATE - ($2::int || ' days')::interval ${where}
      GROUP BY a.att_date ORDER BY a.att_date`,
    params,
  );
}

/** Attendance broken down by state, month by month. */
export async function attendanceByMonth(sessionId: number, centerId: number | null) {
  const params: unknown[] = [sessionId];
  const where = scoped(centerId, params, "a.center_id");
  return query<{
    month: string; label: string;
    present: string; late: string; half_day: string; leave: string; absent: string;
  }>(
    `SELECT to_char(a.att_date, 'YYYY-MM') AS month, to_char(a.att_date, 'Mon') AS label,
            count(*) FILTER (WHERE a.status = 'present')  AS present,
            count(*) FILTER (WHERE a.status = 'late')     AS late,
            count(*) FILTER (WHERE a.status = 'half_day') AS half_day,
            count(*) FILTER (WHERE a.status = 'leave')    AS leave,
            count(*) FILTER (WHERE a.status = 'absent')   AS absent
       FROM student_attendance a
      WHERE a.session_id = $1 ${where}
      GROUP BY 1, 2 ORDER BY 1`,
    params,
  );
}

/** Head count and attendance for each class. */
export async function byClass(sessionId: number, centerId: number | null) {
  const params: unknown[] = [sessionId];
  const where = scoped(centerId, params, "e.center_id");
  return query<{ class_name: string; students: string; attendance_pct: string | null }>(
    `SELECT cl.name AS class_name, count(DISTINCT e.student_id) AS students,
            round(100.0 * count(a.*) FILTER (WHERE a.status IN ('present','late','half_day'))
                  / NULLIF(count(a.*) FILTER (WHERE a.status <> 'holiday'), 0), 1) AS attendance_pct
       FROM enrollments e
       JOIN class_levels cl ON cl.id = e.class_level_id
       LEFT JOIN student_attendance a ON a.enrollment_id = e.id
      WHERE e.session_id = $1 AND e.status = 'active' ${where}
      GROUP BY cl.name, cl.sequence ORDER BY cl.sequence`,
    params,
  );
}

/** Head count and attendance for each centre. */
export async function byCentre(sessionId: number) {
  return query<{ center_name: string; students: string; attendance_pct: string | null }>(
    `SELECT c.name AS center_name, count(DISTINCT e.student_id) AS students,
            round(100.0 * count(a.*) FILTER (WHERE a.status IN ('present','late','half_day'))
                  / NULLIF(count(a.*) FILTER (WHERE a.status <> 'holiday'), 0), 1) AS attendance_pct
       FROM centers c
       LEFT JOIN enrollments e ON e.center_id = c.id AND e.session_id = $1 AND e.status = 'active'
       LEFT JOIN student_attendance a ON a.enrollment_id = e.id
      WHERE c.is_active
      GROUP BY c.name, c.code ORDER BY c.code`,
    [sessionId],
  );
}
