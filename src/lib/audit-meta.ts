/**
 * The vocabulary of an audit, kept free of server imports so a form component
 * can label its own radio buttons without a round trip.
 */

/* ------------------------------------------------------------- visit kinds */

export const VISIT_KINDS = ["scheduled", "follow_up", "special"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];

export const VISIT_KIND_LABEL: Record<VisitKind, string> = {
  scheduled: "Scheduled visit",
  follow_up: "Follow-up visit",
  special: "Special visit",
};

export const VISIT_KIND_BLURB: Record<VisitKind, string> = {
  scheduled: "Planned in advance. The centre knows it is coming.",
  follow_up: "Returning to check that earlier suggestions were acted on.",
  special: "Unannounced. The centre is not told until the report is filed.",
};

/**
 * A special visit is a surprise, so the centre must not be able to see it
 * sitting in the diary. Every read for a centre-side role runs through this.
 */
export function visitIsHiddenFromCentre(kind: VisitKind, status: VisitStatus) {
  return kind === "special" && status !== "submitted";
}

/* ---------------------------------------------------------------- statuses */

export const VISIT_STATUSES = ["planned", "in_progress", "submitted", "cancelled"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABEL: Record<VisitStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  submitted: "Filed",
  cancelled: "Cancelled",
};

/* ------------------------------------------------------- the centre's state */

export const OVERALLS = ["healthy", "attention", "support", "urgent"] as const;
export type Overall = (typeof OVERALLS)[number];

export const OVERALL_LABEL: Record<Overall, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  support: "Support required",
  urgent: "Immediate intervention",
};

export const OVERALL_BLURB: Record<Overall, string> = {
  healthy: "Everything running well",
  attention: "Minor issues present",
  support: "Needs help from outside the centre",
  urgent: "Act today",
};

/** Worst first, so a sort by this puts the centres that need help at the top. */
export const OVERALL_RANK: Record<Overall, number> = {
  urgent: 0, support: 1, attention: 2, healthy: 3,
};

/* ------------------------------------------------------------------- bands */

/**
 * Four bands, best to worst, plus 0 for "does not apply here". A band of 0 is
 * left out of the score entirely rather than counted as a zero — a centre with
 * no toilet to inspect should not be marked down for it.
 */
export const BANDS = [4, 3, 2, 1] as const;
export type Band = 0 | 1 | 2 | 3 | 4;

export const BAND_LABEL: Record<number, string> = {
  4: "Good", 3: "Fair", 2: "Weak", 1: "Poor", 0: "Not applicable",
};

/** A band at or below this has to be explained. */
export const BAND_NEEDS_REASON = 2;

/* --------------------------------------------------------------- priority */

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", critical: "Critical",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

/** How long a centre gets, by priority, when the auditor does not set a date. */
export const PRIORITY_DAYS: Record<Priority, number> = {
  critical: 3, high: 7, medium: 21, low: 45,
};

/* ------------------------------------------------------- suggestion states */

export const SUGGESTION_STATUSES = [
  "open", "in_progress", "done", "verified", "not_done", "dropped",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  open: "Not started",
  in_progress: "Being worked on",
  done: "Centre says done",
  verified: "Verified by auditor",
  not_done: "Not done",
  dropped: "Withdrawn",
};

/** Still the centre's problem: counted as outstanding, and can run overdue. */
export function isOutstanding(status: SuggestionStatus) {
  return status === "open" || status === "in_progress" || status === "done";
}

export const VERDICTS = ["done_well", "partly", "not_done"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
  done_well: "Done properly",
  partly: "Partly done",
  not_done: "Not done",
};

/* ----------------------------------------------------------------- scoring */

export type ScoreSettings = {
  ratingWeightPct: number;
  pointsDoneWell: number;
  pointsPartly: number;
  pointsLate: number;
  pointsNotDone: number;
};

export const DEFAULT_SCORE_SETTINGS: ScoreSettings = {
  ratingWeightPct: 60,
  pointsDoneWell: 100,
  pointsPartly: 50,
  pointsLate: 60,
  pointsNotDone: 0,
};

/**
 * A visit's rating score, 0–100.
 *
 * Band 4 is full marks and band 1 is none, so the four bands sit at 100/67/33/0
 * rather than 100/75/50/25 — a centre scoring "Poor" on everything should score
 * zero, not a quarter. Weights let a criterion like child safety count for more
 * than punctuality. Bands of 0 are dropped, and a visit with nothing scored
 * returns null rather than a misleading 0.
 */
export function ratingScore(
  rows: { band: number; weight: number }[],
): number | null {
  const scored = rows.filter((r) => r.band > 0);
  if (scored.length === 0) return null;
  const got = scored.reduce((n, r) => n + (r.band - 1) * r.weight, 0);
  const max = scored.reduce((n, r) => n + 3 * r.weight, 0);
  return max === 0 ? null : Math.round((got / max) * 1000) / 10;
}

/**
 * What one closed suggestion earned, 0–100. Doing the work late still counts
 * for most of the marks; the centre did fix it, which is the point.
 */
export function suggestionPoints(
  s: { verdict: string | null; due_on: string | null; done_claimed_on: string | null },
  set: ScoreSettings,
): number {
  if (s.verdict === "not_done" || s.verdict == null) return set.pointsNotDone;
  if (s.verdict === "partly") return set.pointsPartly;
  const late = s.due_on != null && s.done_claimed_on != null
    && s.done_claimed_on > s.due_on;
  return late ? set.pointsLate : set.pointsDoneWell;
}

/** The two halves put together, as the award is decided. */
export function combinedScore(
  rating: number | null, action: number | null, set: ScoreSettings,
): number | null {
  if (rating == null && action == null) return null;
  if (action == null) return rating;   // nothing was ever asked of them
  if (rating == null) return action;   // no visit scored yet this month
  const w = set.ratingWeightPct / 100;
  return Math.round((rating * w + action * (1 - w)) * 10) / 10;
}

/* ---------------------------------------------------------- centre priority */

/**
 * The flag shown against a centre everywhere it is listed. Derived rather than
 * stored, so it cannot go stale: it is whatever is true right now about the last
 * visit and the work still outstanding.
 */
export type CentrePriority = "critical" | "high" | "watch" | "ok";

export const CENTRE_PRIORITY_LABEL: Record<CentrePriority, string> = {
  critical: "Critical",
  high: "Action needed",
  watch: "Watch",
  ok: "On track",
};

export function centrePriority(x: {
  overall: Overall | null;
  overdue: number;
  criticalOpen: number;
  openTotal: number;
}): CentrePriority {
  if (x.overall === "urgent" || x.criticalOpen > 0) return "critical";
  if (x.overall === "support" || x.overdue > 0) return "high";
  if (x.overall === "attention" || x.openTotal > 0) return "watch";
  return "ok";
}

/* ------------------------------------------------------------- row shapes */

/**
 * The shapes the queries return. They live here rather than beside the SQL
 * because a client component needs to name them in its props, and importing
 * anything from the query module would drag "server-only" into the browser.
 */

export type Criterion = {
  id: number; section: string; position: number; title: string; question: string;
  band_labels: string[]; reasons: string[]; weight: number; is_active: boolean;
};

export type VisitRow = {
  id: number; center_id: number; center_name: string; center_code: string;
  auditor_id: number | null; auditor_name: string | null;
  kind: VisitKind; status: VisitStatus;
  scheduled_for: string | null; visited_on: string | null;
  overall: Overall | null; score_pct: string | null; summary: string | null;
  children_present: number | null; children_on_roll: number | null;
  staff_present: number | null; staff_on_roll: number | null;
  suggestions: number; open_suggestions: number;
};

export type RatingRow = {
  id: number; criterion_id: number | null; section: string; criterion_title: string;
  weight: number; band: number; reason: string | null; note: string | null;
};

export type SuggestionRow = {
  id: number; visit_id: number | null; center_id: number; center_name: string;
  criterion_id: number | null; criterion_title: string | null;
  title: string; detail: string | null;
  priority: Priority; status: SuggestionStatus; verdict: Verdict | null;
  due_on: string | null; raised_on: string; done_claimed_on: string | null;
  verified_on: string | null;
  raised_by_name: string | null;
  replies: number; overdue: boolean;
};

export type ReplyRow = {
  id: number; author_id: number | null; author_name: string | null;
  author_role: string | null; body: string; set_status: string | null;
  created_at: string;
};

export type Standing = {
  center_id: number; center_name: string; center_code: string;
  overall: Overall | null; last_visited_on: string | null; last_score: string | null;
  open_total: number; overdue: number; critical_open: number;
  next_visit_on: string | null;
  priority: CentrePriority;
};

export type MonthlyRow = {
  center_id: number; center_name: string; center_code: string;
  visits: number; rating: number | null;
  closed: number; action: number | null;
  score: number | null;
};
