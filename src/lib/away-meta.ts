/**
 * Why a member of staff is checking in from away from their centre.
 *
 * Kept short and concrete: the list has to cover the honest reasons a teacher
 * is elsewhere at the start of the day, and nothing else. "Other" carries a
 * note, because a reason nobody can read is not a reason.
 */
export const AWAY_REASONS = [
  "Home visits in the community",
  "At another centre today",
  "Training or a meeting",
  "Travelling for the organisation",
  "Centre's pin on the map looks wrong",
  "Other — written below",
] as const;

export type AwayReason = (typeof AWAY_REASONS)[number];
