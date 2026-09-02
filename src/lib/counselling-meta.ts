/**
 * Why a teacher asks the mentor to sit with a child. Picked from a list rather
 * than typed, so the statistics can group referrals and the mentor knows what
 * they are walking into. Shared by server and client.
 */

export const FLAG_REASONS = [
  "Falling behind in class",
  "Frequently absent",
  "Withdrawn or very quiet",
  "Disruptive in class",
  "Bullied by other children",
  "Bullying other children",
  "Signs of neglect at home",
  "Parents not engaging",
  "Child is working",
  "Health or nutrition concern",
  "Speech or hearing difficulty",
  "Risk of dropping out",
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number];

export const FLAG_STATUS_LABEL: Record<string, string> = {
  open: "Awaiting mentor",
  in_progress: "Counselling under way",
  closed: "Closed",
};

export const FLAG_STATUS_TONE: Record<string, string> = {
  open: "warn", in_progress: "info", closed: "ok",
};

export const URGENCY_LABEL: Record<string, string> = {
  normal: "Normal", high: "Urgent",
};
