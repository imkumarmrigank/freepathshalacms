import "server-only";
import { query } from "./db";

/**
 * A day's work, person by person.
 *
 * Both the auditor's and the mentor's day are read the same way: by the day
 * the work was *entered*, not the day it is filed under. A mentor who spends
 * Friday writing up a fortnight of visits has worked on Friday, and until this
 * page existed that Friday looked empty — which is exactly how a week of
 * recorded meetings came to look like missing data.
 */

const IST = "AT TIME ZONE 'Asia/Kolkata'";

export type AuditorDay = {
  day: string; auditor_id: number; auditor: string;
  visits_filed: number; visits_made: number; centres: string | null;
  children_seen: number; avg_score: number | null;
  suggestions: number; replies: number; verified: number; scheduled: number;
};

/** What each auditor did, day by day. */
export function auditorDays(
  from: string, to: string, centerId: number | null, auditorId: number | null,
) {
  const args: unknown[] = [from, to];
  const centre = centerId ? ` AND v.center_id = $${args.push(centerId)}` : "";
  const who = auditorId ? ` AND u.id = $${args.push(auditorId)}` : "";
  return query<AuditorDay>(
    `WITH visits AS (
       SELECT (v.created_at ${IST})::date AS day, v.auditor_id AS person,
              count(*)::int AS filed,
              count(*) FILTER (WHERE v.visited_on = (v.created_at ${IST})::date)::int AS same_day,
              string_agg(DISTINCT c.name, ', ') AS centres,
              sum(COALESCE(v.children_present, 0))::int AS children,
              round(avg(v.score_pct))::int AS avg_score
         FROM audit_visits v
         JOIN centers c ON c.id = v.center_id
        WHERE (v.created_at ${IST})::date BETWEEN $1 AND $2 ${centre}
        GROUP BY 1, 2
     ),
     made AS (
       SELECT v.visited_on AS day, v.auditor_id AS person, count(*)::int AS n
         FROM audit_visits v
        WHERE v.visited_on BETWEEN $1 AND $2 ${centre}
        GROUP BY 1, 2
     ),
     sugg AS (
       SELECT (s.created_at ${IST})::date AS day, s.raised_by AS person, count(*)::int AS n
         FROM audit_suggestions s
        WHERE (s.created_at ${IST})::date BETWEEN $1 AND $2
          ${centerId ? `AND s.center_id = $3` : ""}
        GROUP BY 1, 2
     ),
     replies AS (
       SELECT (r.created_at ${IST})::date AS day, r.author_id AS person, count(*)::int AS n
         FROM audit_replies r
        WHERE (r.created_at ${IST})::date BETWEEN $1 AND $2
        GROUP BY 1, 2
     ),
     verified AS (
       SELECT s.verified_on AS day, s.verified_by AS person, count(*)::int AS n
         FROM audit_suggestions s
        WHERE s.verified_on BETWEEN $1 AND $2
        GROUP BY 1, 2
     ),
     booked AS (
       SELECT (v.created_at ${IST})::date AS day, v.scheduled_by AS person, count(*)::int AS n
         FROM audit_visits v
        WHERE v.scheduled_for IS NOT NULL
          AND (v.created_at ${IST})::date BETWEEN $1 AND $2 ${centre}
        GROUP BY 1, 2
     ),
     days AS (
       SELECT day, person FROM visits
       UNION SELECT day, person FROM made
       UNION SELECT day, person FROM sugg
       UNION SELECT day, person FROM replies
       UNION SELECT day, person FROM verified
       UNION SELECT day, person FROM booked
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day, u.id AS auditor_id, u.name AS auditor,
            COALESCE(v.filed, 0) AS visits_filed, COALESCE(m.n, 0) AS visits_made,
            v.centres, COALESCE(v.children, 0) AS children_seen, v.avg_score,
            COALESCE(s.n, 0) AS suggestions, COALESCE(r.n, 0) AS replies,
            COALESCE(ve.n, 0) AS verified, COALESCE(b.n, 0) AS scheduled
       FROM days d
       JOIN users u ON u.id = d.person
       LEFT JOIN visits v   ON v.day = d.day AND v.person = d.person
       LEFT JOIN made m     ON m.day = d.day AND m.person = d.person
       LEFT JOIN sugg s     ON s.day = d.day AND s.person = d.person
       LEFT JOIN replies r  ON r.day = d.day AND r.person = d.person
       LEFT JOIN verified ve ON ve.day = d.day AND ve.person = d.person
       LEFT JOIN booked b   ON b.day = d.day AND b.person = d.person
      WHERE u.role = 'auditor' ${who}
      ORDER BY d.day DESC, u.name`,
    args);
}

export type MentorDay = {
  day: string; mentor_id: number; mentor: string;
  written_up: number; meeting_dates: number; oldest_meeting: string | null;
  met_today: number; children: number; centres: string | null;
  follow_ups_promised: number; flags_raised: number;
  counselling_steps: number; feedback: number;
};

/** What each mentor did, day by day. */
export function mentorDays(
  from: string, to: string, centerId: number | null, mentorId: number | null,
) {
  const args: unknown[] = [from, to];
  const centre = centerId ? ` AND i.center_id = $${args.push(centerId)}` : "";
  const who = mentorId ? ` AND u.id = $${args.push(mentorId)}` : "";
  const centreNo = centerId ? 3 : 0;
  return query<MentorDay>(
    `WITH written AS (
       SELECT (i.created_at ${IST})::date AS day, i.mentor_id AS person,
              count(*)::int AS n,
              count(DISTINCT i.interaction_date)::int AS dates,
              to_char(min(i.interaction_date), 'YYYY-MM-DD') AS oldest,
              count(DISTINCT i.student_id)::int AS children,
              string_agg(DISTINCT c.name, ', ') AS centres,
              count(*) FILTER (WHERE i.follow_up_required)::int AS follow_ups
         FROM ptm_interactions i
         JOIN centers c ON c.id = i.center_id
        WHERE (i.created_at ${IST})::date BETWEEN $1 AND $2 ${centre}
        GROUP BY 1, 2
     ),
     held AS (
       SELECT i.interaction_date AS day, i.mentor_id AS person, count(*)::int AS n
         FROM ptm_interactions i
        WHERE i.interaction_date BETWEEN $1 AND $2 ${centre}
        GROUP BY 1, 2
     ),
     flags AS (
       SELECT f.raised_on AS day, f.raised_by AS person, count(*)::int AS n
         FROM counselling_flags f
        WHERE f.raised_on BETWEEN $1 AND $2
          ${centreNo ? `AND f.center_id = $${centreNo}` : ""}
        GROUP BY 1, 2
     ),
     steps AS (
       SELECT a.acted_on AS day, a.acted_by AS person, count(*)::int AS n
         FROM counselling_actions a
        WHERE a.acted_on BETWEEN $1 AND $2
        GROUP BY 1, 2
     ),
     feedback AS (
       SELECT (fb.created_at ${IST})::date AS day, fb.mentor_id AS person, count(*)::int AS n
         FROM centre_feedback fb
        WHERE (fb.created_at ${IST})::date BETWEEN $1 AND $2
          ${centreNo ? `AND fb.center_id = $${centreNo}` : ""}
        GROUP BY 1, 2
     ),
     days AS (
       SELECT day, person FROM written
       UNION SELECT day, person FROM held
       UNION SELECT day, person FROM flags
       UNION SELECT day, person FROM steps
       UNION SELECT day, person FROM feedback
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day, u.id AS mentor_id, u.name AS mentor,
            COALESCE(w.n, 0) AS written_up, COALESCE(w.dates, 0) AS meeting_dates,
            w.oldest AS oldest_meeting, COALESCE(h.n, 0) AS met_today,
            COALESCE(w.children, 0) AS children, w.centres,
            COALESCE(w.follow_ups, 0) AS follow_ups_promised,
            COALESCE(fl.n, 0) AS flags_raised, COALESCE(st.n, 0) AS counselling_steps,
            COALESCE(fb.n, 0) AS feedback
       FROM days d
       JOIN users u ON u.id = d.person
       LEFT JOIN written w  ON w.day = d.day AND w.person = d.person
       LEFT JOIN held h     ON h.day = d.day AND h.person = d.person
       LEFT JOIN flags fl   ON fl.day = d.day AND fl.person = d.person
       LEFT JOIN steps st   ON st.day = d.day AND st.person = d.person
       LEFT JOIN feedback fb ON fb.day = d.day AND fb.person = d.person
      WHERE u.role = 'mentor' ${who}
      ORDER BY d.day DESC, u.name`,
    args);
}

/** The people who appear in a day book, for its picker. */
export function dayBookPeople(role: "auditor" | "mentor" | "sports_teacher") {
  return query<{ id: number; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM users WHERE role = $1
      ORDER BY is_active DESC, name`, [role]);
}

/** One item of work, whatever kind it was — the day book's detail. */
export type DayItem = {
  kind: string; at: string | null; title: string; centre: string | null;
  detail: string | null; extra: string | null; href: string | null;
};

/**
 * Everything one auditor did on one day, item by item.
 *
 * The day book counts; this says what the counts were made of — which visit,
 * which centre, what was asked for. Read by the day the work was entered, as
 * the counts are, so the two always agree.
 */
export function auditorDayDetail(day: string, personId: number, centerId: number | null) {
  const args: unknown[] = [day, personId];
  const centre = centerId ? args.push(centerId) : 0;
  return query<DayItem>(
    `SELECT 'Visit filed' AS kind,
            to_char(v.created_at ${IST}, 'HH24:MI') AS at,
            c.name AS title, c.name AS centre,
            CASE WHEN v.visited_on = (v.created_at ${IST})::date
                 THEN 'Visited and filed the same day'
                 ELSE 'Visit of ' || to_char(v.visited_on, 'DD Mon') END AS detail,
            COALESCE(round(v.score_pct)::text || '% · ' || v.overall, v.status) AS extra,
            '/audits/' || v.id AS href
       FROM audit_visits v
       JOIN centers c ON c.id = v.center_id
      WHERE v.auditor_id = $2 AND (v.created_at ${IST})::date = $1
        ${centre ? `AND v.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Suggestion raised',
            to_char(s.created_at ${IST}, 'HH24:MI'),
            s.title, c.name, s.detail,
            initcap(s.priority) || CASE WHEN s.due_on IS NOT NULL
                 THEN ' · due ' || to_char(s.due_on, 'DD Mon') ELSE '' END,
            '/audits/suggestions/' || s.id
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
      WHERE s.raised_by = $2 AND (s.created_at ${IST})::date = $1
        ${centre ? `AND s.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Reply written',
            to_char(r.created_at ${IST}, 'HH24:MI'),
            s.title, c.name, r.body,
            CASE WHEN r.set_status IS NOT NULL THEN 'Moved to ' || r.set_status END,
            '/audits/suggestions/' || s.id
       FROM audit_replies r
       JOIN audit_suggestions s ON s.id = r.suggestion_id
       JOIN centers c ON c.id = s.center_id
      WHERE r.author_id = $2 AND (r.created_at ${IST})::date = $1
        ${centre ? `AND s.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Claim verified', NULL, s.title, c.name, s.detail,
            COALESCE(initcap(s.verdict), 'verified'),
            '/audits/suggestions/' || s.id
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
      WHERE s.verified_by = $2 AND s.verified_on = $1
        ${centre ? `AND s.center_id = $${centre}` : ""}
     ORDER BY 2 NULLS LAST, 1`,
    args);
}

/** Everything one mentor did on one day, item by item. */
export function mentorDayDetail(day: string, personId: number, centerId: number | null) {
  const args: unknown[] = [day, personId];
  const centre = centerId ? args.push(centerId) : 0;
  return query<DayItem>(
    `SELECT 'Meeting written up' AS kind,
            to_char(i.created_at ${IST}, 'HH24:MI') AS at,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS title,
            c.name AS centre,
            CASE WHEN i.interaction_date = (i.created_at ${IST})::date
                 THEN 'Met the same day'
                 ELSE 'Meeting of ' || to_char(i.interaction_date, 'DD Mon') END AS detail,
            initcap(i.parent_present) || ' · ' || initcap(i.engagement)
              || CASE WHEN i.follow_up_required THEN ' · follow-up promised' ELSE '' END AS extra,
            '/ptm/' || i.id AS href
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers c ON c.id = i.center_id
      WHERE i.mentor_id = $2 AND (i.created_at ${IST})::date = $1
        ${centre ? `AND i.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Counselling step', NULL,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')),
            c.name, a.note,
            CASE a.kind WHEN 'picked_up' THEN 'Picked up'
                        WHEN 'note' THEN 'Followed up'
                        WHEN 'closed' THEN 'Closed'
                        ELSE 'Reopened' END,
            '/students/' || s.id
       FROM counselling_actions a
       JOIN counselling_flags f ON f.id = a.flag_id
       JOIN students s ON s.id = f.student_id
       JOIN centers c ON c.id = f.center_id
      WHERE a.acted_by = $2 AND a.acted_on = $1
        ${centre ? `AND f.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Child referred', NULL,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')),
            c.name, f.note, array_to_string(f.reasons, ', '),
            '/students/' || s.id
       FROM counselling_flags f
       JOIN students s ON s.id = f.student_id
       JOIN centers c ON c.id = f.center_id
      WHERE f.raised_by = $2 AND f.raised_on = $1
        ${centre ? `AND f.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Centre feedback',
            to_char(fb.created_at ${IST}, 'HH24:MI'),
            c.name, c.name, fb.working_well,
            'Rated ' || fb.rating || ' of 5'
              || CASE WHEN fb.urgent THEN ' · urgent' ELSE '' END,
            '/centre-feedback'
       FROM centre_feedback fb
       JOIN centers c ON c.id = fb.center_id
      WHERE fb.mentor_id = $2 AND (fb.created_at ${IST})::date = $1
        ${centre ? `AND fb.center_id = $${centre}` : ""}
     ORDER BY 2 NULLS LAST, 1`,
    args);
}

export type SportsDay = {
  day: string; teacher_id: number; teacher: string;
  visits: number; centres: string | null; children_seen: number; minutes: number;
  attendance_marked: number; sessions: number;
  tests: number; marks: number; remarks: number; reports_filed: number;
};

/** What each sports teacher did, day by day. */
export function sportsDays(
  from: string, to: string, centerId: number | null, teacherId: number | null,
) {
  const args: unknown[] = [from, to];
  const centre = centerId ? args.push(centerId) : 0;
  const who = teacherId ? ` AND u.id = $${args.push(teacherId)}` : "";
  const atCentre = centre ? `AND v.center_id = $${centre}` : "";
  const sportAtCentre = centre ? `AND sp.center_id = $${centre}` : "";
  return query<SportsDay>(
    `WITH visits AS (
       SELECT v.visit_date AS day, v.user_id AS person, count(*)::int AS n,
              string_agg(DISTINCT c.name, ', ') AS centres,
              sum(COALESCE(v.children_count, 0))::int AS children,
              sum(COALESCE(v.worked_minutes, 0))::int AS minutes,
              count(*) FILTER (WHERE v.report_submitted_at IS NOT NULL)::int AS filed
         FROM sports_visits v
         JOIN centers c ON c.id = v.center_id
        WHERE v.visit_date BETWEEN $1 AND $2 ${atCentre}
        GROUP BY 1, 2
     ),
     att AS (
       SELECT (a.marked_at ${IST})::date AS day, a.marked_by AS person,
              count(*)::int AS n, count(DISTINCT (a.sport_id, a.att_date))::int AS sessions
         FROM sport_attendance a
         JOIN sports sp ON sp.id = a.sport_id
        WHERE (a.marked_at ${IST})::date BETWEEN $1 AND $2 ${sportAtCentre}
        GROUP BY 1, 2
     ),
     tests AS (
       SELECT (t.created_at ${IST})::date AS day, t.created_by AS person, count(*)::int AS n
         FROM sport_tests t
         JOIN sports sp ON sp.id = t.sport_id
        WHERE (t.created_at ${IST})::date BETWEEN $1 AND $2 ${sportAtCentre}
        GROUP BY 1, 2
     ),
     marks AS (
       SELECT (m.marked_at ${IST})::date AS day, m.marked_by AS person, count(*)::int AS n
         FROM sport_marks m
         JOIN sport_tests t ON t.id = m.test_id
         JOIN sports sp ON sp.id = t.sport_id
        WHERE (m.marked_at ${IST})::date BETWEEN $1 AND $2 ${sportAtCentre}
        GROUP BY 1, 2
     ),
     notes AS (
       SELECT (ss.remarks_updated_at ${IST})::date AS day, ss.remarks_by AS person,
              count(*)::int AS n
         FROM sport_students ss
         JOIN sports sp ON sp.id = ss.sport_id
        WHERE ss.remarks_updated_at IS NOT NULL
          AND (ss.remarks_updated_at ${IST})::date BETWEEN $1 AND $2 ${sportAtCentre}
        GROUP BY 1, 2
     ),
     days AS (
       SELECT day, person FROM visits
       UNION SELECT day, person FROM att
       UNION SELECT day, person FROM tests
       UNION SELECT day, person FROM marks
       UNION SELECT day, person FROM notes
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day, u.id AS teacher_id, u.name AS teacher,
            COALESCE(v.n, 0) AS visits, v.centres,
            COALESCE(v.children, 0) AS children_seen, COALESCE(v.minutes, 0) AS minutes,
            COALESCE(a.n, 0) AS attendance_marked, COALESCE(a.sessions, 0) AS sessions,
            COALESCE(t.n, 0) AS tests, COALESCE(m.n, 0) AS marks,
            COALESCE(nt.n, 0) AS remarks, COALESCE(v.filed, 0) AS reports_filed
       FROM days d
       JOIN users u ON u.id = d.person
       LEFT JOIN visits v ON v.day = d.day AND v.person = d.person
       LEFT JOIN att a    ON a.day = d.day AND a.person = d.person
       LEFT JOIN tests t  ON t.day = d.day AND t.person = d.person
       LEFT JOIN marks m  ON m.day = d.day AND m.person = d.person
       LEFT JOIN notes nt ON nt.day = d.day AND nt.person = d.person
      WHERE u.role = 'sports_teacher' ${who}
      ORDER BY d.day DESC, u.name`,
    args);
}

/** Everything one sports teacher did on one day, item by item. */
export function sportsDayDetail(day: string, personId: number, centerId: number | null) {
  const args: unknown[] = [day, personId];
  const centre = centerId ? args.push(centerId) : 0;
  return query<DayItem>(
    `SELECT 'Centre visit' AS kind,
            to_char(v.check_in_at ${IST}, 'HH24:MI') AS at,
            c.name AS title, c.name AS centre,
            COALESCE(v.highlights, v.activities) AS detail,
            COALESCE(v.children_count, 0) || ' children'
              || CASE WHEN v.worked_minutes IS NOT NULL
                      THEN ' · ' || v.worked_minutes || ' min' ELSE '' END
              || CASE WHEN v.report_submitted_at IS NOT NULL
                      THEN ' · report filed' ELSE ' · report not filed' END AS extra,
            '/sports' AS href
       FROM sports_visits v
       JOIN centers c ON c.id = v.center_id
      WHERE v.user_id = $2 AND v.visit_date = $1
        ${centre ? `AND v.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Attendance marked',
            to_char(min(a.marked_at) ${IST}, 'HH24:MI'),
            sp.name, c.name,
            'For ' || to_char(a.att_date, 'DD Mon'),
            count(*) || ' children · '
              || count(*) FILTER (WHERE a.status = 'present') || ' present',
            '/sports/' || sp.id
       FROM sport_attendance a
       JOIN sports sp ON sp.id = a.sport_id
       JOIN centers c ON c.id = sp.center_id
      WHERE a.marked_by = $2 AND (a.marked_at ${IST})::date = $1
        ${centre ? `AND sp.center_id = $${centre}` : ""}
      GROUP BY sp.id, sp.name, c.name, a.att_date
     UNION ALL
     SELECT 'Test set',
            to_char(t.created_at ${IST}, 'HH24:MI'),
            t.title, c.name, sp.name,
            'Out of ' || t.max_marks || ' · ' || to_char(t.test_date, 'DD Mon'),
            '/sports/' || sp.id || '/tests/' || t.id
       FROM sport_tests t
       JOIN sports sp ON sp.id = t.sport_id
       JOIN centers c ON c.id = sp.center_id
      WHERE t.created_by = $2 AND (t.created_at ${IST})::date = $1
        ${centre ? `AND sp.center_id = $${centre}` : ""}
     UNION ALL
     SELECT 'Marks entered',
            to_char(min(m.marked_at) ${IST}, 'HH24:MI'),
            t.title, c.name, sp.name,
            count(*) || ' children marked',
            '/sports/' || sp.id || '/tests/' || t.id
       FROM sport_marks m
       JOIN sport_tests t ON t.id = m.test_id
       JOIN sports sp ON sp.id = t.sport_id
       JOIN centers c ON c.id = sp.center_id
      WHERE m.marked_by = $2 AND (m.marked_at ${IST})::date = $1
        ${centre ? `AND sp.center_id = $${centre}` : ""}
      GROUP BY t.id, t.title, c.name, sp.id, sp.name
     UNION ALL
     SELECT 'Remark on a child',
            to_char(ss.remarks_updated_at ${IST}, 'HH24:MI'),
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')), c.name,
            ss.remarks, sp.name, '/students/' || s.id
       FROM sport_students ss
       JOIN sports sp ON sp.id = ss.sport_id
       JOIN students s ON s.id = ss.student_id
       JOIN centers c ON c.id = sp.center_id
      WHERE ss.remarks_by = $2 AND (ss.remarks_updated_at ${IST})::date = $1
        ${centre ? `AND sp.center_id = $${centre}` : ""}
     ORDER BY 2 NULLS LAST, 1`,
    args);
}
