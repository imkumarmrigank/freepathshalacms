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

/**
 * The first day a reason is compulsory. Attendance before it was taken without
 * reasons and stays as it was — correcting an old day does not demand one — so
 * the records that do carry a reason are all ones a teacher actually gave, and
 * a count of "No idea" means what it says.
 */
export const REASONS_REQUIRED_FROM = "2026-09-17";

export function reasonRequiredOn(date: string) {
  return date >= REASONS_REQUIRED_FROM;
}

export function needsReason(status: string) {
  return status === "absent" || status === "leave";
}

export function isReasonFor(status: string, reason: string | null | undefined) {
  return Boolean(reason) && reasonsFor(status).includes(reason as string);
}
