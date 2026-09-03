import "server-only";
import { one, query } from "./db";

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

/**
 * Children whose results are behind, for the mentor to pick up.
 *
 * "Behind" is the same rule promotion uses at the year end — the total against
 * the total of the pass marks on the papers actually sat — so a child flagged
 * here is a child who would repeat the class if the session ended today. It is
 * shown with the last parent meeting and any open counselling referral, because
 * the mentor's first question is always "has anyone spoken to them yet?".
 */
export async function strugglingStudents(
  sessionId: number,
  centerId: number | null,
  limit = 12,
) {
  const params: unknown[] = [sessionId, limit];
  const centreFilter = centerId ? " AND s.center_id = $3" : "";
  if (centerId) params.push(centerId);

  return query<{
    id: number; student: string; class_name: string | null; center_name: string;
    papers: string; obtained: string; max_marks: string; pass_mark: string;
    pct: string; last_ptm: string | null; flagged: boolean;
  }>(
    `WITH res AS (
       SELECT m.student_id,
              count(*) AS papers,
              sum(CASE WHEN m.is_absent THEN 0
                       ELSE COALESCE(m.marks_obtained, 0) END) AS obtained,
              sum(x.max_marks) AS max_marks,
              sum(COALESCE(x.pass_marks, x.max_marks / 3.0)) AS pass_mark
         FROM exam_marks m
         JOIN exams x ON x.id = m.exam_id
        WHERE x.session_id = $1 AND (m.marks_obtained IS NOT NULL OR m.is_absent)
        GROUP BY m.student_id
     )
     SELECT s.id,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            cl.name AS class_name, ce.name AS center_name,
            r.papers, r.obtained, r.max_marks, r.pass_mark,
            round(100.0 * r.obtained / NULLIF(r.max_marks, 0), 1) AS pct,
            (SELECT max(i.interaction_date) FROM ptm_interactions i
              WHERE i.student_id = s.id) AS last_ptm,
            EXISTS (SELECT 1 FROM counselling_flags f
                     WHERE f.student_id = s.id AND f.status <> 'closed') AS flagged
       FROM res r
       JOIN students s ON s.id = r.student_id
       JOIN centers ce ON ce.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE r.obtained < r.pass_mark AND s.status = 'active'${centreFilter}
      ORDER BY (r.obtained / NULLIF(r.pass_mark, 0)) ASC, s.first_name
      LIMIT $2`,
    params,
  );
}

/** Open counselling referrals, for the administrator's overview. */
export async function counsellingLoad(centerId: number | null) {
  const params: unknown[] = [];
  const centreFilter = centerId ? " AND f.center_id = $1" : "";
  if (centerId) params.push(centerId);

  return one<{ open: string; urgent: string; waiting: string; oldest: string | null }>(
    `SELECT count(*) FILTER (WHERE f.status <> 'closed')                       AS open,
            count(*) FILTER (WHERE f.status <> 'closed' AND f.urgency = 'high') AS urgent,
            count(*) FILTER (WHERE f.status = 'open')                           AS waiting,
            min(f.raised_on) FILTER (WHERE f.status <> 'closed')                AS oldest
       FROM counselling_flags f
      WHERE TRUE${centreFilter}`,
    params,
  );
}
