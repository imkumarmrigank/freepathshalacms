import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import { canScheduleVisits, seesAllAudits } from "@/lib/roles";
import {
  CENTRE_PRIORITY_LABEL, OVERALL_LABEL, VISIT_KIND_LABEL, VISIT_STATUS_LABEL,
  countVisits, listVisits, standings,
  type CentrePriority, type VisitStatus,
} from "@/lib/audits";
import ScheduleVisit from "./ScheduleVisit";

export const metadata = { title: "Centre audits · Pehchaan" };

const PRIORITY_TONE: Record<CentrePriority, string> = {
  critical: "bad", high: "warn", watch: "info", ok: "ok",
};

const STATUS_TONE: Record<VisitStatus, string> = {
  planned: "info", in_progress: "warn", submitted: "ok", cancelled: "mute",
};

export default async function AuditsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("auditReports");
  const sp = await searchParams;

  const all = seesAllAudits(user.role);
  // an auditor's list is their own diary; everyone else's is their centre's
  const mine = user.role === "auditor";
  const centreScope = all ? null : user.centerId;

  const pg = pageFrom(sp, 20);
  const filter = {
    centerId: sp.center ? Number(sp.center) : centreScope,
    status: (sp.status as VisitStatus) || null,
    auditorId: mine && sp.all !== "1" ? user.uid : null,
  };

  const [board, visits, total] = await Promise.all([
    standings(all ? null : user.centerId),
    listVisits(user, { ...filter, limit: pg.size, offset: pg.offset }),
    countVisits(user, filter),
  ]);
  const win = pageWindow(pg, visits.length, total);

  return (
    <>
      <PageHeader
        title="Centre audits"
        subtitle={all
          ? "How each centre was found, and what it still owes"
          : "Your centre's visits and what came out of them"}
        right={canScheduleVisits(user.role) ? <ScheduleVisit /> : null}
      />

      {/* ------------------------------------------------------- the board */}
      {board.length > 0 && (
        <Card className="mt-4" pad={false}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[14px] font-semibold">Where each centre stands</h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Worked out from the last filed report and the work still outstanding —
              it is never more than a moment out of date.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[0.05em] text-[var(--faint)]">
                  <th className="px-5 py-2.5 font-medium">Centre</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-3 py-2.5 font-medium">Last visit</th>
                  <th className="px-3 py-2.5 font-medium">Found</th>
                  <th className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th className="px-3 py-2.5 text-right font-medium">Open</th>
                  <th className="px-3 py-2.5 text-right font-medium">Overdue</th>
                  <th className="px-5 py-2.5 font-medium">Next</th>
                </tr>
              </thead>
              <tbody>
                {board.map((b) => (
                  <tr key={b.center_id} className="border-t border-[#f1f1f6]">
                    <td className="px-5 py-2.5">
                      <Link href={`/audits?center=${b.center_id}`}
                        className="font-medium hover:text-[var(--brand)]">
                        {b.center_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={PRIORITY_TONE[b.priority]}>
                        {CENTRE_PRIORITY_LABEL[b.priority]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">
                      {b.last_visited_on ? fmtDate(b.last_visited_on) : "Never"}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">
                      {b.overall ? OVERALL_LABEL[b.overall] : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {b.last_score == null ? "—" : `${Number(b.last_score).toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{b.open_total}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${
                      b.overdue > 0 ? "font-semibold text-[var(--bad)]" : ""}`}>
                      {b.overdue}
                    </td>
                    <td className="px-5 py-2.5 text-[var(--muted)]">
                      {b.next_visit_on ? fmtDate(b.next_visit_on) : "Not booked"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------- the visits */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">
          {mine && sp.all !== "1" ? "Your visits" : "Visits"}
        </h2>
        <div className="flex gap-2 text-[13px]">
          {mine && (
            <Link href={sp.all === "1" ? "/audits" : "/audits?all=1"}
              className="btn btn-ghost">
              {sp.all === "1" ? "Only mine" : "Every auditor"}
            </Link>
          )}
          <Link href="/audits/suggestions" className="btn btn-ghost">Suggestions</Link>
          <Link href="/audits/board" className="btn btn-ghost">Monthly board</Link>
        </div>
      </div>

      <Card className="mt-3" pad={false}>
        {visits.length === 0 ? (
          <Empty title="No visits yet"
            hint={canScheduleVisits(user.role)
              ? "Schedule one with the button above."
              : "An admin schedules these."} />
        ) : (
          <ul>
            {visits.map((v) => (
              <li key={v.id} className="border-t border-[#f1f1f6] first:border-0">
                <Link href={`/audits/${v.id}`}
                  className="block px-5 py-4 hover:bg-[#fafafd]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{v.center_name}</span>
                    <Badge tone={STATUS_TONE[v.status]}>
                      {VISIT_STATUS_LABEL[v.status]}
                    </Badge>
                    {v.kind === "special" && <Badge tone="warn" dot={false}>Surprise</Badge>}
                    {v.kind === "follow_up" && <Badge tone="info" dot={false}>Follow-up</Badge>}
                    <span className="text-[12.5px] text-[var(--muted)]">
                      {VISIT_KIND_LABEL[v.kind]}
                      {" · "}
                      {v.visited_on ? fmtDate(v.visited_on)
                        : v.scheduled_for ? `due ${fmtDate(v.scheduled_for)}` : "no date"}
                      {v.auditor_name ? ` · ${v.auditor_name}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[var(--muted)]">
                    {v.overall && <span>Found: {OVERALL_LABEL[v.overall]}</span>}
                    {v.score_pct != null && (
                      <span className="tabular-nums">
                        Score {Number(v.score_pct).toFixed(0)}%
                      </span>
                    )}
                    {Number(v.suggestions) > 0 && (
                      <span>
                        {v.suggestions} suggestion{Number(v.suggestions) === 1 ? "" : "s"}
                        {Number(v.open_suggestions) > 0 && `, ${v.open_suggestions} still open`}
                      </span>
                    )}
                  </div>
                  {v.summary && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--muted)]">
                      {v.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="visit" />
      </Card>
    </>
  );
}
