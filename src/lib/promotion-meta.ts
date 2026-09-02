/**
 * Who a mid-session promotion came from. It is never nobody: a teacher or the
 * mentor recommends it, or it comes out of what was said at a parent meeting.
 * Shared by server and client.
 */

export const RECOMMENDERS = [
  "Teacher's recommendation",
  "Mentor's recommendation",
  "Parent meeting (PTM)",
  "Teacher and mentor together",
] as const;

export type Recommender = (typeof RECOMMENDERS)[number];

/** The one that needs a meeting picked alongside it. */
export const PTM_RECOMMENDER: Recommender = "Parent meeting (PTM)";
