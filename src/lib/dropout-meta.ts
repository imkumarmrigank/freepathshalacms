/** Shared by the form, the report filter and the student's record. */

/**
 * The reasons the centres actually give. A fixed list rather than free text so
 * the report can group them — "how many children went back to the village this
 * term" is the question that changes what the mentors do next, and it cannot be
 * asked of a column full of one-off sentences.
 */
export const DROPOUT_REASONS = [
  "Family moved away",
  "Went back to the village",
  "Admitted to a government school",
  "Admitted to another school",
  "Started working",
  "Long illness",
  "Too young to continue",
  "Parents withdrew the child",
  "Stopped attending, reason unknown",
  "Other",
] as const;

export type DropoutReason = (typeof DROPOUT_REASONS)[number];

export function isDropoutReason(v: string | null | undefined): v is DropoutReason {
  return Boolean(v) && (DROPOUT_REASONS as readonly string[]).includes(v as string);
}
