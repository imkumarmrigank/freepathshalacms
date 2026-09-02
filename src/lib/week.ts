/**
 * Which days of the week the centres are closed. Sunday is the default, and the
 * super admin can change it — some centres run six days, some five.
 *
 * Stored in app_settings under one key as a comma-separated list of JavaScript
 * day numbers (0 = Sunday). An empty string means "open every day".
 *
 * Shared by server and client — nothing server-only in here.
 */

export const WEEK_OFF_KEY = "attendance.week_off_dow";

/** Index is the JavaScript day number, so DAY_NAMES[0] is Sunday. */
export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Sunday off, which is what every centre ran before this was configurable. */
export const DEFAULT_WEEK_OFF = [0];

export function parseWeekOff(raw: string | null | undefined): number[] {
  if (raw === null || raw === undefined) return DEFAULT_WEEK_OFF;
  const trimmed = raw.trim();
  if (trimmed === "") return [];                       // open seven days
  const days = trimmed.split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

export function formatWeekOff(days: number[]): string {
  return [...new Set(days)].filter((n) => n >= 0 && n <= 6).sort((a, b) => a - b).join(",");
}

/** The day number of an ISO date, read as a plain calendar date. */
export function dowOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function isWeekOff(iso: string, off: number[]): boolean {
  return off.includes(dowOf(iso));
}

export function describeWeekOff(off: number[]): string {
  if (off.length === 0) return "Open every day";
  if (off.length === 7) return "Closed every day";
  const names = off.map((d) => DAY_NAMES[d]);
  const last = names.pop()!;
  return names.length ? `${names.join(", ")} and ${last} off` : `${last} off`;
}
