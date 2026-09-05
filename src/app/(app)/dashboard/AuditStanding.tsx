import Link from "next/link";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import {
  CENTRE_PRIORITY_LABEL, OVERALL_LABEL, type Standing,
} from "@/lib/audit-meta";

/**
 * Where the auditor left things, on the first screen everybody opens.
 *
 * A centre that is on track gets a quiet line; one that is behind gets a
 * coloured band it cannot be missed. Administrators looking at every centre see
 * only the ones that need something — twelve green rows on a dashboard is noise,
 * and noise is what gets scrolled past.
 */
export default function AuditStanding({ rows, everyCentre }: {
  rows: Standing[]; everyCentre: boolean;
}) {
  if (rows.length === 0) return null;

  if (everyCentre) {
    const needy = rows
      .filter((r) => r.priority === "critical" || r.priority === "high")
      .sort((a, b) => (a.priority === "critical" ? -1 : 1) - (b.priority === "critical" ? -1 : 1));
    if (needy.length === 0) return null;

    return (
      <div className="mb-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold">Centres the auditor flagged</h2>
          <Link href="/audits" className="text-[13px] text-[var(--brand)] hover:underline">
            All centres
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2">
          {needy.map((r) => (
            <li key={r.center_id}>
              <Link href={`/audits?center=${r.center_id}`}
                className={`flex items-center gap-2 rounded-[9px] border px-3 py-2 hover:bg-[#fafafd] ${
                  r.priority === "critical"
                    ? "border-[var(--bad)] bg-[var(--bad-soft)]"
                    : "border-[var(--warn)] bg-[var(--warn-soft)]"}`}>
                <span className="text-[13.5px] font-medium">{r.center_name}</span>
                <span className="text-[12px] text-[var(--muted)]">
                  {r.overdue > 0 ? `${r.overdue} overdue` : CENTRE_PRIORITY_LABEL[r.priority]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const me = rows[0];
  if (me.priority === "ok" && me.open_total === 0 && !me.last_visited_on) return null;

  const bad = me.priority === "critical";
  const warn = me.priority === "high";

  return (
    <div className={`mb-5 rounded-[12px] border p-4 ${
      bad ? "border-[var(--bad)] bg-[var(--bad-soft)]"
        : warn ? "border-[var(--warn)] bg-[var(--warn-soft)]"
        : "border-[var(--border)] bg-[var(--surface)]"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Badge tone={bad ? "bad" : warn ? "warn" : me.priority === "watch" ? "info" : "ok"}>
          {CENTRE_PRIORITY_LABEL[me.priority]}
        </Badge>
        <span className="text-[13.5px]">
          {me.open_total > 0 ? (
            <>
              <strong>{me.open_total}</strong> suggestion{me.open_total === 1 ? "" : "s"} from
              the auditor still to deal with
              {me.overdue > 0 && (
                <>, <strong className="text-[var(--bad)]">{me.overdue} past the date</strong></>
              )}
            </>
          ) : (
            "Nothing outstanding from the auditor."
          )}
        </span>
        <span className="text-[12.5px] text-[var(--muted)]">
          {me.last_visited_on
            ? `Last visit ${fmtDate(me.last_visited_on)}${
              me.overall ? ` — ${OVERALL_LABEL[me.overall]}` : ""}`
            : "No visit yet"}
          {me.next_visit_on && ` · next ${fmtDate(me.next_visit_on)}`}
        </span>
        <Link href="/audits/suggestions"
          className="ml-auto text-[13px] font-medium text-[var(--brand)] hover:underline">
          Open suggestions
        </Link>
      </div>
    </div>
  );
}
