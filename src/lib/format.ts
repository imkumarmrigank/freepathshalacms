export function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Renders a DATE column (or ISO string) without timezone drift. */
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const iso = typeof d === "string" ? d.slice(0, 10) : toISODate(d);
  const [y, m, day] = iso.split("-").map(Number);
  if (!y) return "—";
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return `${fmtDate(dt)}, ${dt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  })}`;
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * The date as the people using this system would say it.
 *
 * On the server that is India rather than wherever the instance happens to
 * run — see the TZ setting in the deployment and the SET TIME ZONE on every
 * database connection. In the browser it is the reader's own clock, which for
 * Pehchaan's staff is the same. Never use toISOString() for a date: it is
 * UTC, and until half past five each morning UTC is still yesterday.
 */
export const today = () => toISODate(new Date());

/** Today, shifted by a number of days. Useful for "no later than" limits. */
export function daysFromToday(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function fullName(s: { first_name: string; last_name?: string | null }) {
  return [s.first_name, s.last_name].filter(Boolean).join(" ");
}

export function pct(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  return `${Math.round(Number(n))}%`;
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function minutesToHours(m: number | null | undefined) {
  if (!m) return "—";
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
