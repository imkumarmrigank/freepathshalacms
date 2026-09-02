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
