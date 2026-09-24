/**
 * The vocabulary of the staff tests, shared by the server and the browser.
 *
 * Teachers are the only role tested today; the rest are listed because the
 * question bank and the settings are already keyed by role, so adding mentors
 * is a matter of writing their questions, not of changing any code.
 */
export const TESTED_ROLES = ["teacher", "mentor", "sports_teacher", "center_manager"] as const;
export type TestedRole = (typeof TESTED_ROLES)[number];

export const TEST_STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  expired: "Time ran out",
};

export const TEST_STATUS_TONE: Record<string, string> = {
  in_progress: "info", submitted: "ok", expired: "warn",
};

/** A, B, C, D beside each option — how a paper is read aloud. */
export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Which test of the month a date falls in. The month is cut into as many
 * stretches as there are tests — four by default, so roughly a week each —
 * and the last stretch takes the odd days at the end of the month.
 */
export function slotOf(date: Date, testsPerMonth: number): number {
  const day = date.getDate();
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const per = Math.ceil(days / testsPerMonth);
  return Math.min(testsPerMonth, Math.floor((day - 1) / per) + 1);
}

/** The first of the month the date sits in, as YYYY-MM-DD. */
export function cycleOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "Test 2 of 4" — how a slot is named to the person taking it. */
export function slotLabel(slot: number, testsPerMonth: number) {
  return `Test ${slot} of ${testsPerMonth}`;
}

export function pct(score: number, total: number) {
  return total ? Math.round((score / total) * 100) : 0;
}
