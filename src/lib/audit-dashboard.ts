import "server-only";
import { one, query } from "./db";

/** The month's headline, across every centre. */
export function auditHeadline(from: string, to: string) {
  return one<{
    filed: string; in_progress: string; planned: string; special: string;
    centres_seen: string; avg_score: string | null;
    open_suggestions: string; overdue: string; critical_open: string;
  }>(
    `SELECT
       (SELECT count(*) FROM audit_visits v
         WHERE v.status = 'submitted' AND v.visited_on BETWEEN $1 AND $2)        AS filed,
       (SELECT count(*) FROM audit_visits WHERE status = 'in_progress')          AS in_progress,
       (SELECT count(*) FROM audit_visits
         WHERE status = 'planned' AND scheduled_for >= CURRENT_DATE)             AS planned,
       (SELECT count(*) FROM audit_visits v
         WHERE v.status = 'submitted' AND v.kind = 'special'
           AND v.visited_on BETWEEN $1 AND $2)                                   AS special,
       (SELECT count(DISTINCT v.center_id) FROM audit_visits v
         WHERE v.status = 'submitted' AND v.visited_on BETWEEN $1 AND $2)        AS centres_seen,
       (SELECT round(avg(v.score_pct), 1) FROM audit_visits v
         WHERE v.status = 'submitted' AND v.visited_on BETWEEN $1 AND $2)        AS avg_score,
       (SELECT count(*) FROM audit_suggestions
         WHERE status IN ('open','in_progress','done'))                          AS open_suggestions,
       (SELECT count(*) FROM audit_suggestions
         WHERE status IN ('open','in_progress','done')
           AND due_on IS NOT NULL AND due_on < CURRENT_DATE)                     AS overdue,
       (SELECT count(*) FROM audit_suggestions
         WHERE status IN ('open','in_progress','done') AND priority = 'critical') AS critical_open`,
    [from, to]);
}

/** Each auditor's work: what they have done, and what they have left hanging. */
export function auditorWork(from: string, to: string) {
  return query<{
    auditor_id: number; auditor: string; is_active: boolean;
    filed: number; in_period: number; planned: number; in_progress: number;
    centres: number; avg_score: string | null; last_visit: string | null;
    suggestions: number; still_open: number; overdue: number; verified: number;
  }>(
    `SELECT u.id AS auditor_id, u.name AS auditor, u.is_active,
            count(v.id) FILTER (WHERE v.status = 'submitted')::int            AS filed,
            count(v.id) FILTER (WHERE v.status = 'submitted'
              AND v.visited_on BETWEEN $1 AND $2)::int                        AS in_period,
            count(v.id) FILTER (WHERE v.status = 'planned')::int              AS planned,
            count(v.id) FILTER (WHERE v.status = 'in_progress')::int          AS in_progress,
            count(DISTINCT v.center_id) FILTER (WHERE v.status = 'submitted')::int AS centres,
            round(avg(v.score_pct) FILTER (WHERE v.status = 'submitted'), 1)  AS avg_score,
            to_char(max(v.visited_on) FILTER (WHERE v.status = 'submitted'), 'YYYY-MM-DD') AS last_visit,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.raised_by = u.id)::int                                  AS suggestions,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.raised_by = u.id
                AND s.status IN ('open','in_progress','done'))::int           AS still_open,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.raised_by = u.id AND s.status IN ('open','in_progress','done')
                AND s.due_on IS NOT NULL AND s.due_on < CURRENT_DATE)::int    AS overdue,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.raised_by = u.id AND s.status = 'verified')::int        AS verified
       FROM users u
       LEFT JOIN audit_visits v ON v.auditor_id = u.id
      WHERE u.role = 'auditor'
      GROUP BY u.id, u.name, u.is_active
      ORDER BY u.is_active DESC, count(v.id) DESC, u.name`,
    [from, to]);
}

/** Visits filed month by month, for the trend. */
export function visitsPerMonth(months: number) {
  return query<{ month: string; label: string; n: number }>(
    `SELECT to_char(m, 'YYYY-MM') AS month, to_char(m, 'Mon YY') AS label,
            count(v.id)::int AS n
       FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '${months - 1} months',
                            date_trunc('month', CURRENT_DATE), interval '1 month') m
       LEFT JOIN audit_visits v ON date_trunc('month', v.visited_on) = m AND v.status = 'submitted'
      GROUP BY m ORDER BY m`);
}

/** Where the checklist keeps finding trouble — the weakest points across centres. */
export function weakestChecks(from: string, to: string) {
  return query<{
    section: string; criterion_title: string; rated: number; weak: number; avg_band: string;
  }>(
    `SELECT r.section, r.criterion_title,
            count(*) FILTER (WHERE r.band > 0)::int                      AS rated,
            count(*) FILTER (WHERE r.band BETWEEN 1 AND 2)::int          AS weak,
            round(avg(r.band) FILTER (WHERE r.band > 0), 2)              AS avg_band
       FROM audit_ratings r
       JOIN audit_visits v ON v.id = r.visit_id
      WHERE v.status = 'submitted' AND v.visited_on BETWEEN $1 AND $2
      GROUP BY r.section, r.criterion_title
     HAVING count(*) FILTER (WHERE r.band > 0) > 0
      ORDER BY avg(r.band) FILTER (WHERE r.band > 0), count(*) DESC
      LIMIT 10`,
    [from, to]);
}

/** Centres by how long it is since an auditor was there — where to send them next. */
export function centresBySilence() {
  return query<{
    center_id: number; center_name: string; center_code: string;
    last_visited_on: string | null; days_since: number | null;
    next_visit_on: string | null; open_suggestions: number; overdue: number;
  }>(
    `SELECT c.id AS center_id, c.name AS center_name, c.code AS center_code,
            to_char(last.visited_on, 'YYYY-MM-DD') AS last_visited_on,
            (CURRENT_DATE - last.visited_on)::int  AS days_since,
            to_char(next.scheduled_for, 'YYYY-MM-DD') AS next_visit_on,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.center_id = c.id AND s.status IN ('open','in_progress','done'))::int AS open_suggestions,
            (SELECT count(*) FROM audit_suggestions s
              WHERE s.center_id = c.id AND s.status IN ('open','in_progress','done')
                AND s.due_on IS NOT NULL AND s.due_on < CURRENT_DATE)::int AS overdue
       FROM centers c
       LEFT JOIN LATERAL (
         SELECT v.visited_on FROM audit_visits v
          WHERE v.center_id = c.id AND v.status = 'submitted'
          ORDER BY v.visited_on DESC LIMIT 1) last ON TRUE
       LEFT JOIN LATERAL (
         SELECT v.scheduled_for FROM audit_visits v
          WHERE v.center_id = c.id AND v.status IN ('planned','in_progress')
            AND v.scheduled_for >= CURRENT_DATE
          ORDER BY v.scheduled_for LIMIT 1) next ON TRUE
      WHERE c.is_active
      ORDER BY last.visited_on NULLS FIRST, c.code`);
}

/** Suggestions past the date the centre was given — the office's business. */
export function overdueSuggestions(limit = 25) {
  return query<{
    id: number; title: string; center_name: string; priority: string; status: string;
    due_on: string; days_over: number; auditor: string | null; replies: number;
  }>(
    `SELECT s.id, s.title, c.name AS center_name, s.priority, s.status,
            to_char(s.due_on, 'YYYY-MM-DD') AS due_on,
            (CURRENT_DATE - s.due_on)::int AS days_over,
            u.name AS auditor,
            (SELECT count(*) FROM audit_replies r WHERE r.suggestion_id = s.id)::int AS replies
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN users u ON u.id = s.raised_by
      WHERE s.status IN ('open','in_progress','done')
        AND s.due_on IS NOT NULL AND s.due_on < CURRENT_DATE
      ORDER BY (s.priority = 'critical') DESC, s.due_on
      LIMIT ${limit}`);
}
