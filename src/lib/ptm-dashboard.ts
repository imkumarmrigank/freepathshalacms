import "server-only";
import { SIBLING_COLS, SIBLING_JOIN } from "./siblings";
import { one, query } from "./db";

/** Yesterday's headline: how many meetings were held, and what came of them. */
export async function ptmDay(day: string, centerId: number | null, mentorId: number | null) {
  const p: unknown[] = [day];
  if (centerId) p.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${p.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${p.push(mentorId)}` : "");
  const row = await one<{
    held: string; centres: string; children: string; both_parents: string;
    mother: string; father: string; guardian: string;
    attentive: string; neutral: string; resistant: string;
    follow_ups: string; no_follow_up: string; support: string;
    confidence: string | null; rated: string;
  }>(
    `SELECT count(*) AS held,
            count(DISTINCT i.center_id) AS centres,
            count(DISTINCT i.student_id) AS children,
            count(*) FILTER (WHERE i.parent_present = 'both')        AS both_parents,
            count(*) FILTER (WHERE i.parent_present = 'mother')      AS mother,
            count(*) FILTER (WHERE i.parent_present = 'father')      AS father,
            count(*) FILTER (WHERE i.parent_present = 'guardian')    AS guardian,
            count(*) FILTER (WHERE i.engagement = 'attentive')       AS attentive,
            count(*) FILTER (WHERE i.engagement = 'neutral')         AS neutral,
            count(*) FILTER (WHERE i.engagement = 'resistant')       AS resistant,
            count(*) FILTER (WHERE i.follow_up_required)             AS follow_ups,
            count(*) FILTER (WHERE NOT i.follow_up_required)         AS no_follow_up,
            count(*) FILTER (WHERE i.support_needed IS NOT NULL)     AS support,
            -- how sure the mentor is about each family's progress, 1 to 5;
            -- the average is only over the meetings where it was rated
            round(avg(i.confidence), 1)                              AS confidence,
            count(i.confidence)                                      AS rated
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
    follow_ups: number; roll: number; confidence: string | null;
  }>(
    `SELECT ce.name AS center_name, count(*)::int AS held,
            count(DISTINCT i.student_id)::int AS children,
            count(*) FILTER (WHERE i.engagement = 'attentive')::int AS attentive,
            count(*) FILTER (WHERE i.follow_up_required)::int       AS follow_ups,
            round(avg(i.confidence), 1)                             AS confidence,
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

/**
 * The parent to write down, and the number to ring.
 *
 * A meeting records who came; the name and mobile behind that are on the
 * child's admission record, which is where a teacher would otherwise have to
 * go, child by child, to follow anyone up.
 */
export const PARENT_NAME = `NULLIF(trim(CASE i.parent_present
         WHEN 'mother'   THEN COALESCE(s.mother_name, '')
         WHEN 'father'   THEN COALESCE(s.father_name, '')
         WHEN 'guardian' THEN COALESCE(s.guardian_name, '')
         WHEN 'both'     THEN concat_ws(' & ', NULLIF(s.father_name, ''), NULLIF(s.mother_name, ''))
         ELSE '' END), '') AS parent_name`;

/** Whichever number the family actually answers, best first. */
export const PHONE = `COALESCE(
         NULLIF(CASE i.parent_present
                  WHEN 'mother' THEN s.mother_mobile
                  WHEN 'father' THEN s.father_mobile
                  ELSE NULL END, ''),
         NULLIF(s.primary_phone, ''), NULLIF(s.whatsapp_number, ''),
         NULLIF(s.mother_mobile, ''), NULLIF(s.father_mobile, ''),
         NULLIF(s.alt_phone, '')) AS phone`;

/** The same, for a child nobody met: there is no meeting to say who came. */
export const FAMILY_PHONE = `COALESCE(
         NULLIF(s.primary_phone, ''), NULLIF(s.whatsapp_number, ''),
         NULLIF(s.mother_mobile, ''), NULLIF(s.father_mobile, ''),
         NULLIF(s.alt_phone, '')) AS phone`;

/** The meetings themselves on a day — who was seen, and what was said. */
export function ptmInteractionsOn(day: string, centerId: number | null, mentorId: number | null) {
  const args: unknown[] = [day];
  if (centerId) args.push(centerId);
  const c = `${centerId ? `AND i.center_id = $${args.length}` : ""}`
    + (mentorId ? ` AND i.mentor_id = $${args.push(mentorId)}` : "");
  return query<{
    id: number; student_id: number; student: string; enrollment_no: string;
    class_name: string | null; center_name: string; mentor: string | null;
    parent_present: string; engagement: string; concern_tags: string[];
    follow_up_required: boolean; follow_up_date: string | null;
    follow_up_status: string; discussion: string | null;
    parent_name: string | null; phone: string | null;
    flag_status: string | null; flag_urgency: string | null;
    sibling_count: number; sibling_names: string | null;
  }>(
    `SELECT i.id, i.student_id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, cl.name AS class_name, ce.name AS center_name,
            u.name AS mentor, i.parent_present, i.engagement, i.concern_tags,
            i.follow_up_required, i.follow_up_date, i.follow_up_status, i.discussion,
            ${PARENT_NAME}, ${PHONE},
            cf.status AS flag_status, cf.urgency AS flag_urgency,
            ${SIBLING_COLS}
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN counselling_flags cf ON cf.student_id = s.id AND cf.status <> 'closed'
       ${SIBLING_JOIN}
      WHERE i.interaction_date = $1 ${c}
      ORDER BY ce.code, student`,
    args);
}

/**
 * Who was expected at a centre on a day.
 *
 * A PTM day in the diary says which centre — and sometimes which class — is
 * expecting parents, so the children on that roll are the ones to measure
 * against. Where no day was booked but meetings happened anyway, the centre's
 * own roll stands in; where neither happened, nobody was expected and the
 * list stays empty rather than naming every child in the organisation.
 */
const EXPECTED_ON_DAY = (centerId: number | null) => `
  WITH booked AS (
    SELECT m.center_id, m.session_id, m.class_level_id
      FROM ptm_meetings m
     WHERE m.meeting_date = $1 AND m.status <> 'cancelled'
       ${centerId ? "AND m.center_id = $2" : ""}
    UNION
    SELECT i.center_id, i.session_id, NULL::bigint
      FROM ptm_interactions i
     WHERE i.interaction_date = $1
       ${centerId ? "AND i.center_id = $2" : ""}
       AND NOT EXISTS (SELECT 1 FROM ptm_meetings m2
                        WHERE m2.meeting_date = $1 AND m2.center_id = i.center_id
                          AND m2.status <> 'cancelled')
  ),
  expected AS (
    SELECT DISTINCT e.student_id, e.center_id, e.class_level_id
      FROM booked b
      JOIN enrollments e ON e.center_id = b.center_id AND e.session_id = b.session_id
                        AND e.status = 'active'
                        AND (b.class_level_id IS NULL OR e.class_level_id = b.class_level_id)
      JOIN students s ON s.id = e.student_id AND s.status = 'active'
  )`;

/** Expected, seen and missed on a day — the three numbers above the two lists. */
export async function ptmDayCoverage(day: string, centerId: number | null) {
  const args: unknown[] = centerId ? [day, centerId] : [day];
  const rows = await query<{ expected: number; met: number; missed: number }>(
    `${EXPECTED_ON_DAY(centerId)}
     SELECT count(*)::int AS expected,
            count(*) FILTER (WHERE met.ok)::int AS met,
            count(*) FILTER (WHERE NOT met.ok)::int AS missed
       FROM expected x
       CROSS JOIN LATERAL (
         SELECT EXISTS (SELECT 1 FROM ptm_interactions i
                         WHERE i.student_id = x.student_id
                           AND i.interaction_date = $1) AS ok) met`,
    args);
  return rows[0] ?? { expected: 0, met: 0, missed: 0 };
}

/**
 * The parents who did not come — the list the follow-up is made from. Each
 * child carries the parents' names, a number to ring and when the family was
 * last sat down with, so the call can be made from this page.
 */
export function ptmAbsentees(day: string, centerId: number | null, limit = 200) {
  const args: unknown[] = centerId ? [day, centerId] : [day];
  args.push(limit);
  return query<{
    student_id: number; student: string; enrollment_no: string; class_name: string | null;
    center_name: string; father_name: string | null; mother_name: string | null;
    guardian_name: string | null; phone: string | null; last_met: string | null;
    met_this_session: number; flag_status: string | null; flag_urgency: string | null;
    sibling_count: number; sibling_names: string | null;
    total_rows: string;
  }>(
    `${EXPECTED_ON_DAY(centerId)}
     SELECT count(*) OVER () AS total_rows,
            s.id AS student_id,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, cl.name AS class_name, ce.name AS center_name,
            NULLIF(s.father_name, '') AS father_name,
            NULLIF(s.mother_name, '') AS mother_name,
            NULLIF(s.guardian_name, '') AS guardian_name,
            ${FAMILY_PHONE},
            to_char(seen.last_met, 'YYYY-MM-DD') AS last_met,
            seen.n_session AS met_this_session,
            cf.status AS flag_status, cf.urgency AS flag_urgency,
            ${SIBLING_COLS}
       FROM expected x
       JOIN students s ON s.id = x.student_id
       JOIN centers ce ON ce.id = x.center_id
       LEFT JOIN class_levels cl ON cl.id = x.class_level_id
       LEFT JOIN counselling_flags cf ON cf.student_id = s.id AND cf.status <> 'closed'
       ${SIBLING_JOIN}
       CROSS JOIN LATERAL (
         SELECT max(i.interaction_date) AS last_met,
                count(*) FILTER (WHERE i.session_id = (SELECT id FROM academic_sessions
                                                        WHERE is_current LIMIT 1))::int AS n_session
           FROM ptm_interactions i WHERE i.student_id = x.student_id) seen
      WHERE NOT EXISTS (SELECT 1 FROM ptm_interactions i
                         WHERE i.student_id = x.student_id AND i.interaction_date = $1)
      ORDER BY seen.last_met NULLS FIRST, ce.code, cl.sequence NULLS LAST, s.first_name
      LIMIT $${args.length}`,
    args);
}

/**
 * PTM days that came and went with nothing written up.
 *
 * A day in the diary is a promise to the parents of that centre; if no
 * interaction was recorded against it, either the meeting did not happen or
 * nobody entered it, and both need chasing. A cancelled day is not a failure
 * and is left out; a day marked completed with no record is the worst case of
 * all and is kept in.
 */
export function ptmMissedDays(from: string, to: string, centerId: number | null) {
  const args: unknown[] = [from, to];
  const c = centerId ? ` AND m.center_id = $${args.push(centerId)}` : "";
  return query<{
    id: number; title: string; meeting_date: string; center_name: string;
    class_name: string | null; mode: string; status: string; start_time: string | null;
    roll: number; days_ago: number;
  }>(
    `SELECT m.id, m.title, to_char(m.meeting_date, 'YYYY-MM-DD') AS meeting_date,
            ce.name AS center_name, cl.name AS class_name, m.mode, m.status,
            to_char(m.start_time, 'HH12:MI AM') AS start_time,
            (SELECT count(*) FROM enrollments e JOIN students s ON s.id = e.student_id
              WHERE e.center_id = m.center_id AND e.session_id = m.session_id
                AND e.status = 'active' AND s.status = 'active'
                AND (m.class_level_id IS NULL OR e.class_level_id = m.class_level_id))::int AS roll,
            (CURRENT_DATE - m.meeting_date) AS days_ago
       FROM ptm_meetings m
       JOIN centers ce ON ce.id = m.center_id
       LEFT JOIN class_levels cl ON cl.id = m.class_level_id
      WHERE m.meeting_date BETWEEN $1 AND $2
        AND m.meeting_date < CURRENT_DATE
        AND m.status <> 'cancelled'${c}
        AND NOT EXISTS (
          SELECT 1 FROM ptm_interactions i
           WHERE i.center_id = m.center_id AND i.interaction_date = m.meeting_date
             AND (m.class_level_id IS NULL OR i.class_level_id = m.class_level_id))
      ORDER BY m.meeting_date DESC, ce.code`,
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
