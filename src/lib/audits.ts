import "server-only";
import { one, query } from "./db";
import type { SessionUser } from "./auth";
import { seesAllAudits } from "./roles";
import {
  DEFAULT_SCORE_SETTINGS, centrePriority, combinedScore, ratingScore,
  suggestionPoints,
  type Criterion, type MonthlyRow, type RatingRow, type ReplyRow,
  type ScoreSettings, type Standing, type SuggestionRow, type Verdict,
  type VisitStatus, type VisitRow,
} from "./audit-meta";

export * from "./audit-meta";

/**
 * Centre audits: the visit, what was rated, what was asked for, and whether it
 * was done.
 *
 * The one rule that runs through every read here: a special visit is a surprise,
 * so nobody at the centre being audited may see it until it is filed. That is
 * enforced in SQL rather than in the page, because a page is easy to forget.
 */

/* ---------------------------------------------------------------- settings */

export async function auditSettings(): Promise<ScoreSettings> {
  const r = await one<{
    rating_weight_pct: number; points_done_well: number; points_partly: number;
    points_late: number; points_not_done: number;
  }>("SELECT * FROM audit_settings WHERE id");
  if (!r) return DEFAULT_SCORE_SETTINGS;
  return {
    ratingWeightPct: r.rating_weight_pct,
    pointsDoneWell: r.points_done_well,
    pointsPartly: r.points_partly,
    pointsLate: r.points_late,
    pointsNotDone: r.points_not_done,
  };
}

/* -------------------------------------------------------------- the checklist */

export async function listCriteria(includeRetired = false) {
  return query<Criterion>(
    `SELECT id, section, position, title, question, band_labels, reasons, weight, is_active
       FROM audit_criteria
      ${includeRetired ? "" : "WHERE is_active"}
      ORDER BY position, id`);
}

/* ------------------------------------------------------------- read guards */

/**
 * The SQL fragment that hides a surprise visit from the centre it is about.
 * Returns an empty string for the roles that see everything, so the common case
 * costs nothing.
 */
function visibility(user: SessionUser, params: unknown[], alias = "v") {
  if (seesAllAudits(user.role)) return "";
  const ids = user.role === "backup_teacher"
    ? user.centerIds
    : user.centerId == null ? [] : [user.centerId];
  params.push(ids.length ? ids : [-1]);
  const p = `$${params.length}`;
  return ` AND ${alias}.center_id = ANY(${p})
           AND (${alias}.kind <> 'special' OR ${alias}.status = 'submitted')
           AND ${alias}.status <> 'cancelled'`;
}

/* ----------------------------------------------------------------- visits */

const VISIT_COLS = `
  v.id, v.center_id, c.name AS center_name, c.code AS center_code,
  v.auditor_id, u.name AS auditor_name, v.kind, v.status,
  v.scheduled_for, v.visited_on, v.overall, v.score_pct, v.summary,
  v.children_present, v.children_on_roll, v.staff_present, v.staff_on_roll,
  (SELECT count(*) FROM audit_suggestions s WHERE s.visit_id = v.id) AS suggestions,
  (SELECT count(*) FROM audit_suggestions s
    WHERE s.visit_id = v.id AND s.status IN ('open','in_progress','done')) AS open_suggestions`;

export async function listVisits(user: SessionUser, opts: {
  centerId?: number | null; status?: VisitStatus | null; auditorId?: number | null;
  limit?: number; offset?: number;
} = {}) {
  const params: unknown[] = [];
  let where = "WHERE TRUE";
  if (opts.centerId) { params.push(opts.centerId); where += ` AND v.center_id = $${params.length}`; }
  if (opts.status) { params.push(opts.status); where += ` AND v.status = $${params.length}`; }
  if (opts.auditorId) { params.push(opts.auditorId); where += ` AND v.auditor_id = $${params.length}`; }
  where += visibility(user, params);

  params.push(opts.limit ?? 50, opts.offset ?? 0);
  return query<VisitRow>(
    `SELECT ${VISIT_COLS}
       FROM audit_visits v
       JOIN centers c ON c.id = v.center_id
       LEFT JOIN users u ON u.id = v.auditor_id
      ${where}
      ORDER BY COALESCE(v.visited_on, v.scheduled_for) DESC NULLS LAST, v.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params);
}

export async function countVisits(user: SessionUser, opts: {
  centerId?: number | null; status?: VisitStatus | null; auditorId?: number | null;
} = {}) {
  const params: unknown[] = [];
  let where = "WHERE TRUE";
  if (opts.centerId) { params.push(opts.centerId); where += ` AND v.center_id = $${params.length}`; }
  if (opts.status) { params.push(opts.status); where += ` AND v.status = $${params.length}`; }
  if (opts.auditorId) { params.push(opts.auditorId); where += ` AND v.auditor_id = $${params.length}`; }
  where += visibility(user, params);
  const r = await one<{ n: string }>(
    `SELECT count(*) AS n FROM audit_visits v ${where}`, params);
  return Number(r?.n ?? 0);
}

/** One visit, or null when this person may not see it. */
export async function getVisit(user: SessionUser, id: number) {
  const params: unknown[] = [id];
  const where = `WHERE v.id = $1` + visibility(user, params);
  return one<VisitRow>(
    `SELECT ${VISIT_COLS}
       FROM audit_visits v
       JOIN centers c ON c.id = v.center_id
       LEFT JOIN users u ON u.id = v.auditor_id
      ${where}`, params);
}

/* ---------------------------------------------------------------- ratings */

export async function ratingsFor(visitId: number) {
  return query<RatingRow>(
    `SELECT r.id, r.criterion_id, r.section, r.criterion_title, r.weight,
            r.band, r.reason, r.note
       FROM audit_ratings r
       LEFT JOIN audit_criteria c ON c.id = r.criterion_id
      WHERE r.visit_id = $1
      ORDER BY COALESCE(c.position, 9999), r.id`, [visitId]);
}

/* ------------------------------------------------------------ suggestions */

const SUGG_COLS = `
  s.id, s.visit_id, s.center_id, c.name AS center_name,
  s.criterion_id, cr.title AS criterion_title,
  s.title, s.detail, s.priority, s.status, s.verdict,
  s.due_on, s.raised_on, s.done_claimed_on, s.verified_on,
  u.name AS raised_by_name,
  (SELECT count(*) FROM audit_replies r WHERE r.suggestion_id = s.id) AS replies,
  (s.status IN ('open','in_progress')
     AND s.due_on IS NOT NULL AND s.due_on < CURRENT_DATE) AS overdue`;

export async function listSuggestions(user: SessionUser, opts: {
  centerId?: number | null; visitId?: number | null; open?: boolean;
  limit?: number; offset?: number;
} = {}) {
  const params: unknown[] = [];
  let where = "WHERE TRUE";
  if (opts.centerId) { params.push(opts.centerId); where += ` AND s.center_id = $${params.length}`; }
  if (opts.visitId) { params.push(opts.visitId); where += ` AND s.visit_id = $${params.length}`; }
  if (opts.open) where += ` AND s.status IN ('open','in_progress','done')`;

  // A suggestion belongs to the centre, so it is readable there even though the
  // surprise visit that produced it is not — but only once that visit is filed.
  if (!seesAllAudits(user.role)) {
    const ids = user.role === "backup_teacher"
      ? user.centerIds
      : user.centerId == null ? [] : [user.centerId];
    params.push(ids.length ? ids : [-1]);
    where += ` AND s.center_id = ANY($${params.length})
               AND (s.visit_id IS NULL OR EXISTS (
                 SELECT 1 FROM audit_visits v
                  WHERE v.id = s.visit_id AND v.status = 'submitted'))`;
  }

  params.push(opts.limit ?? 100, opts.offset ?? 0);
  return query<SuggestionRow>(
    `SELECT ${SUGG_COLS}
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN audit_criteria cr ON cr.id = s.criterion_id
       LEFT JOIN users u ON u.id = s.raised_by
      ${where}
      ORDER BY
        CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1
                      WHEN 'done' THEN 2 ELSE 3 END,
        CASE s.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2 ELSE 3 END,
        s.due_on NULLS LAST, s.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params);
}

export async function getSuggestion(user: SessionUser, id: number) {
  const params: unknown[] = [id];
  let where = "WHERE s.id = $1";
  if (!seesAllAudits(user.role)) {
    const ids = user.role === "backup_teacher"
      ? user.centerIds
      : user.centerId == null ? [] : [user.centerId];
    params.push(ids.length ? ids : [-1]);
    where += ` AND s.center_id = ANY($${params.length})
               AND (s.visit_id IS NULL OR EXISTS (
                 SELECT 1 FROM audit_visits v
                  WHERE v.id = s.visit_id AND v.status = 'submitted'))`;
  }
  return one<SuggestionRow>(
    `SELECT ${SUGG_COLS}
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN audit_criteria cr ON cr.id = s.criterion_id
       LEFT JOIN users u ON u.id = s.raised_by
      ${where}`, params);
}

/**
 * What the auditor is handed when they arrive: everything still outstanding
 * from previous visits, so the first thing they do is check whether it was
 * done rather than starting from scratch.
 */
export async function outstandingForCentre(centerId: number) {
  return query<SuggestionRow>(
    `SELECT ${SUGG_COLS}
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN audit_criteria cr ON cr.id = s.criterion_id
       LEFT JOIN users u ON u.id = s.raised_by
      WHERE s.center_id = $1 AND s.status IN ('open','in_progress','done')
      ORDER BY
        CASE s.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2 ELSE 3 END,
        s.due_on NULLS LAST, s.id`, [centerId]);
}

/* --------------------------------------------------------------- replies */

export async function repliesFor(suggestionId: number) {
  return query<ReplyRow>(
    `SELECT r.id, r.author_id, u.name AS author_name, u.role AS author_role,
            r.body, r.set_status, r.created_at
       FROM audit_replies r
       LEFT JOIN users u ON u.id = r.author_id
      WHERE r.suggestion_id = $1
      ORDER BY r.id`, [suggestionId]);
}

/* ------------------------------------------------------- the centre's state */

/**
 * One row per centre: how the last visit found it and what is still owed.
 * Everything is derived, so nothing here can drift out of date.
 */
export async function standings(centerId?: number | null): Promise<Standing[]> {
  const params: unknown[] = [];
  const filter = centerId ? (params.push(centerId), ` WHERE c.id = $${params.length}`) : "";
  const rows = await query<Omit<Standing, "priority"> & {
    open_total: string; overdue: string; critical_open: string;
  }>(
    `SELECT c.id AS center_id, c.name AS center_name, c.code AS center_code,
            last.overall, last.visited_on AS last_visited_on,
            last.score_pct AS last_score,
            COALESCE(o.open_total, 0)   AS open_total,
            COALESCE(o.overdue, 0)      AS overdue,
            COALESCE(o.critical_open, 0) AS critical_open,
            nxt.scheduled_for AS next_visit_on
       FROM centers c
       LEFT JOIN LATERAL (
         SELECT v.overall, v.visited_on, v.score_pct
           FROM audit_visits v
          WHERE v.center_id = c.id AND v.status = 'submitted'
          ORDER BY v.visited_on DESC NULLS LAST, v.id DESC LIMIT 1) last ON TRUE
       LEFT JOIN LATERAL (
         SELECT count(*) FILTER (WHERE s.status IN ('open','in_progress','done')) AS open_total,
                count(*) FILTER (WHERE s.status IN ('open','in_progress')
                                   AND s.due_on IS NOT NULL
                                   AND s.due_on < CURRENT_DATE) AS overdue,
                count(*) FILTER (WHERE s.status IN ('open','in_progress')
                                   AND s.priority = 'critical') AS critical_open
           FROM audit_suggestions s WHERE s.center_id = c.id) o ON TRUE
       LEFT JOIN LATERAL (
         SELECT v.scheduled_for FROM audit_visits v
          WHERE v.center_id = c.id AND v.status = 'planned'
            AND v.scheduled_for IS NOT NULL
          ORDER BY v.scheduled_for LIMIT 1) nxt ON TRUE
       ${filter}
      ORDER BY c.name`, params);

  return rows.map((r) => ({
    ...r,
    open_total: Number(r.open_total),
    overdue: Number(r.overdue),
    critical_open: Number(r.critical_open),
    priority: centrePriority({
      overall: r.overall,
      overdue: Number(r.overdue),
      criticalOpen: Number(r.critical_open),
      openTotal: Number(r.open_total),
    }),
  }));
}

/**
 * A centre's standing as the centre's own staff see it — the same numbers, but
 * the surprise-visit rule still applies, so a filed report is required before
 * its overall rating shows.
 */
export async function standingFor(centerId: number) {
  const [row] = await standings(centerId);
  return row ?? null;
}

/* ------------------------------------------------------------ the award */

/**
 * The month's table, which is what the Best Centre award is read off.
 *
 * Ratings come from visits filed inside the month. Action points come from
 * suggestions the auditor gave a verdict on inside the month — a centre is
 * credited when the work is confirmed, not when it is claimed, so the two
 * halves cannot be gamed against each other.
 */
export async function monthly(month: string): Promise<MonthlyRow[]> {
  const set = await auditSettings();

  const visits = await query<{
    center_id: number; center_name: string; center_code: string;
    visits: string; rating: string | null;
  }>(
    `SELECT c.id AS center_id, c.name AS center_name, c.code AS center_code,
            count(v.id) AS visits,
            avg(v.score_pct) FILTER (WHERE v.score_pct IS NOT NULL) AS rating
       FROM centers c
       LEFT JOIN audit_visits v
         ON v.center_id = c.id AND v.status = 'submitted'
        AND to_char(v.visited_on, 'YYYY-MM') = $1
      GROUP BY c.id, c.name, c.code
      ORDER BY c.name`, [month]);

  const closed = await query<{
    center_id: number; verdict: Verdict | null;
    due_on: string | null; done_claimed_on: string | null;
  }>(
    `SELECT center_id, verdict, due_on, done_claimed_on
       FROM audit_suggestions
      WHERE verified_on IS NOT NULL AND to_char(verified_on, 'YYYY-MM') = $1`,
    [month]);

  const byCentre = new Map<number, number[]>();
  for (const s of closed) {
    const list = byCentre.get(s.center_id) ?? [];
    list.push(suggestionPoints(s, set));
    byCentre.set(s.center_id, list);
  }

  return visits.map((v) => {
    const pts = byCentre.get(v.center_id) ?? [];
    const action = pts.length
      ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10
      : null;
    const rating = v.rating == null ? null : Math.round(Number(v.rating) * 10) / 10;
    return {
      center_id: v.center_id,
      center_name: v.center_name,
      center_code: v.center_code,
      visits: Number(v.visits),
      rating,
      closed: pts.length,
      action,
      score: combinedScore(rating, action, set),
    };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/* ------------------------------------------------------------- the people */

export async function auditors() {
  return query<{ id: number; name: string; email: string }>(
    `SELECT id, name, email FROM users
      WHERE role = 'auditor' AND is_active ORDER BY name`);
}

/** Recomputes and freezes a visit's rating score. Called when it is filed. */
export async function freezeScore(visitId: number) {
  const rows = await query<{ band: number; weight: number }>(
    "SELECT band, weight FROM audit_ratings WHERE visit_id = $1", [visitId]);
  const score = ratingScore(rows);
  await query("UPDATE audit_visits SET score_pct = $2, updated_at = now() WHERE id = $1",
    [visitId, score]);
  return score;
}

/* ------------------------------------------------------------- the roll */

/**
 * What the system believes is on the roll at a centre today: children enrolled
 * in the current session, and the staff expected to be there.
 *
 * The auditor still counts heads themselves — that is the whole point of a
 * visit — but they should not have to look up the denominator. It is offered as
 * a starting figure they can overwrite, never written on their behalf.
 *
 * Staff counts the centre's own manager and teachers, plus any backup teacher
 * standing in there today, and leaves out anyone on approved leave — the
 * question is "how many should be here", not "how many are on the payroll".
 */
export async function rollFor(centerId: number, on: string) {
  const [kids, staff] = await Promise.all([
    one<{ n: string }>(
      `SELECT count(*) AS n
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN academic_sessions a ON a.id = e.session_id AND a.is_current
        WHERE e.center_id = $1 AND e.status = 'active' AND s.status = 'active'`,
      [centerId]),
    one<{ n: string }>(
      `SELECT count(DISTINCT u.id) AS n
         FROM users u
        WHERE u.is_active
          AND (
            (u.role IN ('center_manager','teacher') AND u.center_id = $1)
            OR EXISTS (
              SELECT 1 FROM teacher_coverage tc
               WHERE tc.backup_id = u.id AND tc.center_id = $1
                 AND tc.starts_on <= $2
                 AND (tc.ends_on IS NULL OR tc.ends_on >= $2))
          )
          AND NOT EXISTS (
            SELECT 1 FROM staff_attendance sa
             WHERE sa.user_id = u.id AND sa.att_date = $2
               AND sa.status IN ('leave','holiday'))`,
      [centerId, on]),
  ]);
  return { children: Number(kids?.n ?? 0), staff: Number(staff?.n ?? 0) };
}
