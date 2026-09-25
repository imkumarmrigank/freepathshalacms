/** Shared by the register and the server — no server-only imports. */

/**
 * What a teacher may mark. Two buttons and no more: a child is either at the
 * centre or is not, and the reason underneath carries everything else — a
 * festival, an approved absence, arriving late. Late, half day and leave were
 * three ways of asking the same question twice, and the registers came back
 * inconsistent between centres.
 */
export const MARK_OPTIONS = [
  { value: "present", label: "P", title: "Present", color: "var(--ok)" },
  { value: "absent",  label: "A", title: "Absent",  color: "var(--bad)" },
] as const;

export const MARKABLE = new Set(MARK_OPTIONS.map((o) => o.value as string));

/**
 * Marks that exist in the register from before, and from the nightly close-out.
 * They are shown where they were recorded — rewriting a year of registers to
 * suit a new set of buttons would lose what actually happened — but they can no
 * longer be given to a child today.
 */
export const LEGACY_STATUS_LABEL: Record<string, string> = {
  late: "Late", half_day: "Half day", leave: "Leave", holiday: "Holiday",
};


/** Why a child was absent. Chosen, not typed, so the answers can be counted. */
export const ABSENT_REASONS = [
  "Sick",
  "Didn't wake up",
  "Distance issue",
  "Parents allowed it",
  "Siblings responsibility",
  "Visiting Hometown",
  "Need Followup",
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
 * a count of "Need Followup" means what it says.
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
