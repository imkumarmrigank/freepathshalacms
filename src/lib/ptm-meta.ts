/**
 * The options on the Freepathshala PTM Mentor Interaction Form, kept in one
 * place so the form, the detail page and the reports all read the same list.
 * Shared by server and client — nothing server-only in here.
 */

export const PTM_MODES = [
  { value: "in_person", label: "In Person" },
  { value: "video", label: "Video Call" },
] as const;

export const PARENT_PRESENT = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "both", label: "Both Parents" },
  { value: "guardian", label: "Guardian" },
] as const;

export const ENGAGEMENT = [
  { value: "attentive", label: "Attentive and engaged" },
  { value: "neutral", label: "Neutral" },
  { value: "resistant", label: "Resistant or disengaged" },
] as const;

/** "Problems expressed by Parent" — the category, and what it covers. */
export const CONCERN_OPTIONS = [
  { name: "Child Not Attending Regularly", hint: "Child is absent or irregular at FreePathshala." },
  { name: "Child Struggling with Learning", hint: "Child struggles with reading, writing, maths, or understanding concepts." },
  { name: "Difficulty Supporting Homework at Home", hint: "Child cannot complete homework or parent cannot provide study support." },
  { name: "Child’s Behaviour or Emotional Concerns", hint: "Behaviour, discipline, concentration, or emotional difficulties." },
  { name: "School Admission or Continuation Issues", hint: "Admission to mainstream school, school documents, fees, or risk of dropping out." },
  { name: "Family Moving or Change of Residence", hint: "Family has moved or plans to move, affecting the child's education or attendance." },
  { name: "Financial Difficulties Affecting Child’s Education", hint: "Family cannot afford books, stationery, uniform, fees, or transport." },
  { name: "Child’s Health Concerns", hint: "Illness or health issues affecting attendance, learning, or well-being." },
  { name: "Parent’s Job or Employment Issues", hint: "Parent is unemployed, seeking work, or work commitments affect the child." },
  { name: "Other", hint: "" },
] as const;

export const CONCERNS = CONCERN_OPTIONS.map((c) => c.name);

/** Ticking this one means nothing else was promised. */
export const NO_COMMITMENT = "No commitment taken";

export const COMMITMENTS = [
  "Ensure regular attendance", "Support homework at home", "Monitor school progress",
  "Complete admission-related tasks", "Inform Freepathshala before relocation",
  "Attend next PTM", "Other", NO_COMMITMENT,
] as const;

export const FOLLOW_UP_PRIORITY = [
  { value: "high", label: "High (within one week)" },
  { value: "medium", label: "Medium (within one month)" },
  { value: "low", label: "Low (next PTM)" },
] as const;

/**
 * Who follows up, and when. The date is worked out from the owner rather than
 * typed: teacher and principal check back in a week, the mentor in a month.
 */
export const FOLLOW_UP_OWNER_OPTIONS = [
  { value: "Teacher", weeks: 1, priority: "high" },
  { value: "Mentor", weeks: 4, priority: "medium" },
  { value: "Principal", weeks: 1, priority: "high" },
] as const;

export const FOLLOW_UP_OWNERS = FOLLOW_UP_OWNER_OPTIONS.map((o) => o.value);

/** The auto follow-up date for an owner, as YYYY-MM-DD, counted from `from`. */
export function followUpDateFor(owner: string, from: Date = new Date()) {
  const o = FOLLOW_UP_OWNER_OPTIONS.find((x) => x.value === owner) ?? FOLLOW_UP_OWNER_OPTIONS[1];
  const d = new Date(from);
  if (o.value === "Mentor") d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 7 * o.weeks);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const CONFIDENCE = [1, 2, 3, 4, 5] as const;

const labelOf = <T extends readonly { value: string; label: string }[]>(list: T, v: string | null) =>
  list.find((o) => o.value === v)?.label ?? (v ?? "—");

export const modeLabel = (v: string | null) => labelOf(PTM_MODES, v);
export const parentLabel = (v: string | null) => labelOf(PARENT_PRESENT, v);
export const engagementLabel = (v: string | null) => labelOf(ENGAGEMENT, v);
export const priorityLabel = (v: string | null) => labelOf(FOLLOW_UP_PRIORITY, v);

export const PRIORITY_TONE: Record<string, string> = {
  high: "bad", medium: "warn", low: "mute",
};
