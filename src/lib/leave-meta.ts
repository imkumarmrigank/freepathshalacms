/** Leave vocabulary — shared by the teacher's form, the approval queue and the reports. */

export const LEAVE_TYPES = [
  { value: "casual",    label: "Casual leave" },
  { value: "sick",      label: "Sick leave" },
  { value: "emergency", label: "Emergency" },
  { value: "planned",   label: "Planned / personal" },
  { value: "unpaid",    label: "Unpaid leave" },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]["value"];

export const LEAVE_LABEL: Record<string, string> =
  Object.fromEntries(LEAVE_TYPES.map((t) => [t.value, t.label]));

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Withdrawn",
};

export const LEAVE_STATUS_TONE: Record<string, string> = {
  pending: "warn", approved: "ok", rejected: "bad", cancelled: "mute",
};

export function isLeaveType(v: string): v is LeaveType {
  return LEAVE_TYPES.some((t) => t.value === v);
}

/** Calendar days covered by a request — half days count as one day for the list. */
export function leaveDays(startsOn: string, endsOn: string) {
  const a = new Date(`${startsOn}T00:00:00Z`).getTime();
  const b = new Date(`${endsOn}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export type LeaveRow = {
  id: number;
  user_id: number;
  staff_name: string;
  role: string;
  center_name: string | null;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  half_day: boolean;
  reason: string;
  status: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  /** Who is standing in while they are away, when cover has been assigned. */
  backup_name: string | null;
};
