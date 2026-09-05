/** Shared by server and client — no "use client", no server-only imports. */
export const EXAM_TYPES = [
  { value: "unit_test", label: "Unit test" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "other", label: "Other" },
] as const;

export const EXAM_TYPE_LABEL: Record<string, string> =
  Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t.label]));

/** Percentage -> grade, the common Indian school scale. */
export function grade(pct: number | null) {
  if (pct === null) return "—";
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "E";
}

export function percentage(obtained: number | null, max: number) {
  if (obtained === null || !max) return null;
  return Math.round((obtained / max) * 1000) / 10;
}

/**
 * Subjects that are judged rather than examined.
 *
 * The registers carry Behaviour and Activities alongside the seven taught
 * subjects, and they matter — a child who is settling in well is worth
 * recording. But they are not academic marks: a Behaviour score out of 10 added
 * to an English paper out of 50 would quietly move the percentage the whole
 * report is read on. So they are kept, shown, and left out of the total.
 */
export const CO_SCHOLASTIC = [
  "Behaviour", "Behavior", "Activities", "Co-scholastic",
  "Discipline", "Conduct",
] as const;

const CO_SET = new Set<string>(CO_SCHOLASTIC.map((s) => s.toLowerCase()));

export function isCoScholastic(subject: string) {
  return CO_SET.has(subject.trim().toLowerCase());
}

/**
 * Behaviour is often written as a word rather than a number — "Good", "G",
 * "Excellent". Where a centre grades it, show the grade; where a centre scores
 * it, show the score out of its maximum.
 */
export function conductLabel(obtained: number | null, max: number) {
  if (obtained === null) return null;
  const pct = max > 0 ? (obtained / max) * 100 : null;
  if (pct === null) return String(obtained);
  if (pct >= 85) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Fair";
  return "Needs attention";
}
