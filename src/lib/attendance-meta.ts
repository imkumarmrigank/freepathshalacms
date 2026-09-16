/** Shared by the register and the server — no server-only imports. */

/** Why a child was absent. Chosen, not typed, so the answers can be counted. */
export const ABSENT_REASONS = [
  "Sick",
  "Didn't wake up",
  "Distance issue",
  "Parents allowed it",
  "Siblings responsibility",
  "No idea",
  "Parents not aware",
  "Drop",
] as const;

/** Why a child was on leave. */
export const LEAVE_REASONS = [
  "Approved leave",
  "Festival",
  "Marriage",
] as const;

/** The reasons that fit a mark, or none when the mark needs no reason. */
export function reasonsFor(status: string): readonly string[] {
  if (status === "absent") return ABSENT_REASONS;
  if (status === "leave") return LEAVE_REASONS;
  return [];
}

export function needsReason(status: string) {
  return status === "absent" || status === "leave";
}

export function isReasonFor(status: string, reason: string | null | undefined) {
  return Boolean(reason) && reasonsFor(status).includes(reason as string);
}
