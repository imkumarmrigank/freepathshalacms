/** Shared by server and client — must not import anything server-only. */
export type CalendarEvent = {
  id: number;
  title: string;
  event_type: string;
  center_id: number | null;
  center_name: string | null;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  affects_attendance: boolean;
  source: "calendar" | "ptm";
};

export const EVENT_LABEL: Record<string, string> = {
  holiday: "Holiday", ptm: "PTM", exam: "Exam", event: "Event",
  feast: "Feast", activity: "Activity", closure: "Centre closed", other: "Other",
};

export const EVENT_TONE: Record<string, string> = {
  holiday: "bad", closure: "bad", ptm: "info", exam: "warn",
  feast: "ok", activity: "ok", event: "mute", other: "mute",
};

/** Types that suppress the auto-absent close-out. */
export const HOLIDAY_TYPES = new Set(["holiday", "closure"]);
