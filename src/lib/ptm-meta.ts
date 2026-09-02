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

export const CONCERNS = [
  "Student Attendance", "Learning Progress", "Homework Support", "Behaviour",
  "School Admission", "Relocation", "Financial Challenges", "Health",
  "Parent Employment", "Other",
] as const;

export const COMMITMENTS = [
  "Ensure regular attendance", "Support homework at home", "Monitor school progress",
  "Complete admission-related tasks", "Inform Freepathshala before relocation",
  "Attend next PTM", "Other",
] as const;

export const FOLLOW_UP_PRIORITY = [
  { value: "high", label: "High (within one week)" },
  { value: "medium", label: "Medium (within one month)" },
  { value: "low", label: "Low (next PTM)" },
] as const;

export const FOLLOW_UP_OWNERS = [
  "Same Mentor", "Centre Teacher", "Principal", "Counsellor",
] as const;

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
