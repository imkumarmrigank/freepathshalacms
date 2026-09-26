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
export function dayBookPeople(role: "auditor" | "mentor") {
  return query<{ id: number; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM users WHERE role = $1
      ORDER BY is_active DESC, name`, [role]);
}
