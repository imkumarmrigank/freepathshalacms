import "server-only";
import { one, query } from "./db";

/** Yesterday's headline: how many meetings were held, and what came of them. */
export async function ptmDay(day: string, centerId: number | null, mentorId: number | null) {
  const p: unknown[] = [day];
  if (centerId) p.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${p.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${p.push(mentorId)}` : "");
  const row = await one<{
    held: string; centres: string; children: string; both_parents: string;
    attentive: string; neutral: string; resistant: string;
    follow_ups: string; no_follow_up: string; support: string;
  }>(
    `SELECT count(*) AS held,
            count(DISTINCT i.center_id) AS centres,
            count(DISTINCT i.student_id) AS children,
            count(*) FILTER (WHERE i.parent_present = 'both')        AS both_parents,
            count(*) FILTER (WHERE i.engagement = 'attentive')       AS attentive,
            count(*) FILTER (WHERE i.engagement = 'neutral')         AS neutral,
            count(*) FILTER (WHERE i.engagement = 'resistant')       AS resistant,
            count(*) FILTER (WHERE i.follow_up_required)             AS follow_ups,
            count(*) FILTER (WHERE NOT i.follow_up_required)         AS no_follow_up,
            count(*) FILTER (WHERE i.support_needed IS NOT NULL)     AS support
       FROM ptm_interactions i
      WHERE i.interaction_date = $1 ${c}`,
    p);
  return row;
}

/**
 * Which centres held meetings on a day, how each went, and how many children
 * are on that centre's roll — twelve meetings at a centre of twenty is a
 * different day from twelve at a centre of a hundred.
 */
export function ptmByCentre(day: string, centerId: number | null, mentorId: number | null) {
  const args: unknown[] = [day];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{
    center_name: string; held: number; children: number; attentive: number;
    follow_ups: number; roll: number;
  }>(
    `SELECT ce.name AS center_name, count(*)::int AS held,
            count(DISTINCT i.student_id)::int AS children,
            count(*) FILTER (WHERE i.engagement = 'attentive')::int AS attentive,
            count(*) FILTER (WHERE i.follow_up_required)::int       AS follow_ups,
            (SELECT count(*) FROM enrollments e
               JOIN students s ON s.id = e.student_id
               JOIN academic_sessions a ON a.id = e.session_id AND a.is_current
              WHERE e.center_id = ce.id AND e.status = 'active'
                AND s.status = 'active')::int                       AS roll
       FROM ptm_interactions i JOIN centers ce ON ce.id = i.center_id
      WHERE i.interaction_date = $1 ${c}
      GROUP BY ce.id, ce.code, ce.name ORDER BY count(*) DESC, ce.code`,
    args);
}

/** What parents were worried about, counted across a period. */
export function ptmConcerns(
  from: string, to: string, centerId: number | null, mentorId: number | null,
) {
  const args: unknown[] = [from, to];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{ concern: string; n: number; centres: number }>(
    `SELECT t AS concern, count(*)::int AS n, count(DISTINCT i.center_id)::int AS centres
       FROM ptm_interactions i, unnest(i.concern_tags) AS t
      WHERE i.interaction_date BETWEEN $1 AND $2 ${c}
      GROUP BY t ORDER BY count(*) DESC, t`,
    args);
}

/** What parents promised, over the same period — the other half of a PTM. */
export function ptmCommitments(
  from: string, to: string, centerId: number | null, mentorId: number | null,
) {
  const args: unknown[] = [from, to];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{ commitment: string; n: number }>(
    `SELECT t AS commitment, count(*)::int AS n
       FROM ptm_interactions i, unnest(i.commitment_tags) AS t
      WHERE i.interaction_date BETWEEN $1 AND $2 ${c}
      GROUP BY t ORDER BY count(*) DESC, t`,
    args);
}

/**
 * Meetings per day over a run of days, split by who came — a day of twenty
 * meetings that only mothers attended is a different day from twenty where
 * both parents came.
 */
export function ptmPerDay(
  from: string, to: string, centerId: number | null, mentorId: number | null,
) {
  const args: unknown[] = [from, to];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{
    day: string; n: number; mother: number; father: number; both: number; guardian: number;
  }>(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
            count(i.id)::int AS n,
            count(i.id) FILTER (WHERE i.parent_present = 'mother')::int   AS mother,
            count(i.id) FILTER (WHERE i.parent_present = 'father')::int   AS father,
            count(i.id) FILTER (WHERE i.parent_present = 'both')::int     AS both,
            count(i.id) FILTER (WHERE i.parent_present = 'guardian')::int AS guardian
       FROM generate_series($1::date, $2::date, interval '1 day') d
       LEFT JOIN ptm_interactions i ON i.interaction_date = d::date ${c}
      GROUP BY d ORDER BY d`,
    args);
}

/** The meetings themselves on a day — who was seen, and what was said. */
export function ptmInteractionsOn(day: string, centerId: number | null, mentorId: number | null) {
  const args: unknown[] = [day];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{
    id: number; student: string; enrollment_no: string; class_name: string | null;
    center_name: string; mentor: string | null; parent_present: string; engagement: string;
    concern_tags: string[]; follow_up_required: boolean; follow_up_date: string | null;
    follow_up_status: string; discussion: string | null;
  }>(
    `SELECT i.id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, cl.name AS class_name, ce.name AS center_name,
            u.name AS mentor, i.parent_present, i.engagement, i.concern_tags,
            i.follow_up_required, i.follow_up_date, i.follow_up_status, i.discussion
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
       LEFT JOIN users u ON u.id = i.mentor_id
      WHERE i.interaction_date = $1 ${c}
      ORDER BY ce.code, student`,
    args);
}

/** PTM days in the diary for a date — the centres expecting parents today. */
export function ptmScheduled(day: string, centerId: number | null) {
  const c = centerId ? "AND m.center_id = $2" : "";
  return query<{
    id: number; title: string; center_name: string; class_name: string | null;
    start_time: string | null; end_time: string | null; mode: string; status: string;
    agenda: string | null; held: number; roll: number;
  }>(
    `SELECT m.id, m.title, ce.name AS center_name, cl.name AS class_name,
            to_char(m.start_time, 'HH12:MI AM') AS start_time,
            to_char(m.end_time, 'HH12:MI AM') AS end_time,
            m.mode, m.status, m.agenda,
            (SELECT count(*) FROM ptm_interactions i
              WHERE i.center_id = m.center_id AND i.interaction_date = m.meeting_date
                AND (m.class_level_id IS NULL OR i.class_level_id = m.class_level_id))::int AS held,
            (SELECT count(*) FROM enrollments e JOIN students s ON s.id = e.student_id
              WHERE e.center_id = m.center_id AND e.session_id = m.session_id
                AND e.status = 'active' AND s.status = 'active'
                AND (m.class_level_id IS NULL OR e.class_level_id = m.class_level_id))::int AS roll
       FROM ptm_meetings m
       JOIN centers ce ON ce.id = m.center_id
       LEFT JOIN class_levels cl ON cl.id = m.class_level_id
      WHERE m.meeting_date = $1 ${c}
      ORDER BY m.start_time NULLS LAST, ce.code`,
    centerId ? [day, centerId] : [day]);
}

/**
 * Who can be asked for on the dashboard: every mentor, and separately anyone
 * else who has recorded a meeting — a teacher who wrote one up is not a
 * mentor, and must not be listed as one.
 *
 * A teacher reads this page for their own centre, so the names are cut to that
 * centre too: the mentors posted there and anyone who has actually written up
 * a meeting there. Someone else's mentor is not their business, and the count
 * beside a name is the work done at the centre in view.
 */
export function ptmPeople(centerId: number | null) {
  const args: unknown[] = [];
  if (centerId) args.push(centerId);
  const at = centerId ? ` AND i.center_id = $1` : "";
  return query<{ id: number; name: string; role: string; recorded: number }>(
    `SELECT u.id, u.name, u.role,
            (SELECT count(*) FROM ptm_interactions i
              WHERE i.mentor_id = u.id${at})::int AS recorded
       FROM users u
      WHERE (u.role = 'mentor'${centerId ? " AND u.center_id = $1" : ""})
         OR EXISTS (SELECT 1 FROM ptm_interactions i WHERE i.mentor_id = u.id${at})
      ORDER BY (u.role = 'mentor') DESC, u.name`, args);
}
