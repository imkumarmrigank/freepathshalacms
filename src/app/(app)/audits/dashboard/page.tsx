import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { BarChart, ChartFrame, HBarChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { fmtDate, today } from "@/lib/format";
import { canScheduleVisits } from "@/lib/roles";
import { BAND_LABEL, PRIORITY_LABEL, SUGGESTION_STATUS_LABEL } from "@/lib/audit-meta";
import {
  auditHeadline, auditorList, auditorWork, centresBySilence, overdueSuggestions,
  visitsPerMonth, weakestChecks,
} from "@/lib/audit-dashboard";
import Filters from "@/components/Filters";
import { centersForUser, resolveCenterId } from "@/lib/queries";

export const metadata = { title: "Auditor dashboard · Pehchaan" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

/**
 * What the auditors have been doing, and what the office has to decide:
 * which centres have not been seen, which suggestions have run past their
 * date, and where the checklist keeps finding the same trouble.
 */
export default async function AuditorDashboardPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (!canScheduleVisits(user.role)) redirect("/audits");
  const sp = await searchParams;
  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 90;
  const now = today();
  const from = addDays(now, -(days - 1));

  const [people, centers] = await Promise.all([auditorList(), centersForUser(user)]);
  // with more than one auditor, the office reads one auditor's work at a time
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const whoName = people.find((p) => p.id === who)?.name;
  const centerId = resolveCenterId(user, sp.center);

  const [head, auditors, perMonth, weak, centres, overdue] = await Promise.all([
    auditHeadline(from, now, who, centerId), auditorWork(from, now, who, centerId),
    visitsPerMonth(6, who, centerId), weakestChecks(from, now, who, centerId),
    centresBySilence(centerId), overdueSuggestions(who, centerId),
  ]);

  /** Every link keeps the filters already chosen. */
  const link = (over: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | null> = {
      days: String(days), who: who ? String(who) : null, center: sp.center ?? null, ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/audits/dashboard?${q.toString()}`;
  };

  const n = (v: string | null | undefined) => Number(v ?? 0);
  const neverSeen = centres.filter((c) => !c.last_visited_on);
  const stale = centres.filter((c) => c.days_since !== null && c.days_since > 60);

  return (
    <>
      <PageHeader title="Auditor dashboard"
        subtitle={whoName
          ? `${whoName}'s visits, scores and suggestions`
          : "Every auditor's work, and what the office needs to decide"}
        right={<Link href="/audits" className="btn btn-ghost btn-sm">Visits &amp; standing</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {people.length > 1 && (
          <>
            <Link href={link({ who: null })} scroll={false}
              className={`btn btn-sm ${who === null ? "btn-primary" : "btn-ghost"}`}>
              Every auditor
            </Link>
            {people.map((p) => (
              <Link key={p.id} href={link({ who: String(p.id) })} scroll={false}
                className={`btn btn-sm ${who === p.id ? "btn-primary" : "btn-ghost"}`}>
                {p.name}
              </Link>
            ))}
            <span className="mx-1 text-[var(--border-strong)]">|</span>
          </>
        )}
        {RANGES.map((r) => (
          <Link key={r.value} href={link({ days: r.value })} scroll={false}
            className={`btn btn-sm ${String(days) === r.value ? "btn-primary" : "btn-ghost"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <Filters centers={centers} current={sp} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visits filed" value={n(head?.filed)}
          hint={`${n(head?.centres_seen)} centres · ${n(head?.special)} unannounced`} />
        <StatCard label="Average score" value={head?.avg_score ? `${head.avg_score}%` : "—"}
          hint="on the visits filed"
          tone={head?.avg_score && Number(head.avg_score) < 60 ? "warn" : "default"} />
        <StatCard label="Visits in hand" value={n(head?.planned) + n(head?.in_progress)}
          hint={`${n(head?.planned)} planned · ${n(head?.in_progress)} being filled in`} />
        <StatCard label="Suggestions open" value={n(head?.open_suggestions)}
          hint={`${n(head?.overdue)} overdue · ${n(head?.critical_open)} critical`}
          tone={n(head?.overdue) > 0 ? "bad" : "default"} />
      </div>

      {/* ------------------------------------------------ the auditors */}
      <div className="label-cap mb-2.5 mt-6">Each auditor</div>
      <Card pad={false}>
        {auditors.length === 0 ? (
          <Empty title="No auditors yet"
            hint="Add one under Administration → Staff with the Auditor role." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Auditor</th><th>Filed</th><th>In this period</th><th>In hand</th>
                  <th>Centres seen</th><th>Average score</th><th>Last visit</th>
                  <th>Suggestions</th><th>Still open</th><th>Overdue</th><th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {auditors.map((a) => (
                  <tr key={a.auditor_id}>
                    <td className="font-medium">
                      {a.auditor}
                      {!a.is_active && <Badge tone="mute">Inactive</Badge>}
                    </td>
                    <td className="tabular-nums">{a.filed}</td>
                    <td className="tabular-nums">{a.in_period}</td>
                    <td className="tabular-nums text-[var(--muted)]">
                      {a.planned + a.in_progress || "—"}
                    </td>
                    <td className="tabular-nums text-[var(--muted)]">{a.centres}</td>
                    <td className="tabular-nums">{a.avg_score ? `${a.avg_score}%` : "—"}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {a.last_visit ? fmtDate(a.last_visit) : "never"}
                    </td>
                    <td className="tabular-nums">{a.suggestions}</td>
                    <td className="tabular-nums">{a.still_open}</td>
                    <td className={`tabular-nums ${a.overdue ? "text-[var(--bad)]" : ""}`}>{a.overdue}</td>
                    <td className="tabular-nums text-[var(--ok)]">{a.verified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame title="Visits filed each month" subtitle="Across every centre"
          empty={perMonth.every((m) => m.n === 0)}
          table={{ head: ["Month", "Visits"], rows: perMonth.map((m) => [m.label, m.n]) }}>
          <BarChart data={perMonth.map((m) => ({ label: m.label, value: m.n }))} color={SERIES[0]} />
        </ChartFrame>

        <ChartFrame title="Where the checklist finds trouble"
          subtitle={`Average band over the last ${days} days · 4 good, 1 poor · weakest first`}
          empty={weak.length === 0}
          table={{ head: ["Section", "Check", "Times rated", "Weak or poor", "Average band"],
            rows: weak.map((w) => [w.section, w.criterion_title, w.rated, w.weak, w.avg_band]) }}>
          <HBarChart data={weak.map((w) => ({
            label: `${w.criterion_title} (${BAND_LABEL[Math.round(Number(w.avg_band))] ?? ""})`,
            value: Number(w.avg_band),
          }))} color={SERIES[1]} suffix=" of 4" />
        </ChartFrame>
      </div>

      {/* ------------------------------------------- where to send them next */}
      <div className="label-cap mb-2.5 mt-6">
        Where to send an auditor next
        {(neverSeen.length > 0 || stale.length > 0) && (
          <span className="ml-2 font-normal text-[var(--muted)]">
            {neverSeen.length > 0 && `${neverSeen.length} never visited`}
            {neverSeen.length > 0 && stale.length > 0 && " · "}
            {stale.length > 0 && `${stale.length} not seen in two months`}
          </span>
        )}
      </div>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Centre</th><th>Last visit</th><th>Days since</th><th>Next planned</th>
                <th>Open suggestions</th><th>Overdue</th><th></th>
              </tr>
            </thead>
            <tbody>
              {centres.map((c) => (
                <tr key={c.center_id}>
                  <td className="font-medium">{c.center_name}</td>
                  <td className="whitespace-nowrap text-[var(--muted)]">
                    {c.last_visited_on ? fmtDate(c.last_visited_on)
                      : <Badge tone="bad">never visited</Badge>}
                  </td>
                  <td className={`tabular-nums ${c.days_since !== null && c.days_since > 60 ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}>
                    {c.days_since ?? "—"}
                  </td>
                  <td className="whitespace-nowrap text-[var(--muted)]">
                    {c.next_visit_on ? fmtDate(c.next_visit_on)
                      : <span className="text-[var(--faint)]">nothing planned</span>}
                  </td>
                  <td className="tabular-nums">{c.open_suggestions}</td>
                  <td className={`tabular-nums ${c.overdue ? "text-[var(--bad)]" : ""}`}>{c.overdue}</td>
                  <td>
                    <Link href={`/audits?center=${c.center_id}`} className="btn btn-ghost btn-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] px-5 py-3 text-[12.5px] text-[var(--muted)]">
          Schedule a visit from <Link href="/audits" className="underline">Visits &amp; standing</Link> —
          choose the centre, the auditor and the kind of visit.
        </p>
      </Card>

      {/* --------------------------------------------------- what is overdue */}
      <div className="label-cap mb-2.5 mt-6">Suggestions past their date</div>
      <Card pad={false}>
        {overdue.length === 0 ? (
          <Empty title="Nothing overdue" hint="Every centre is within the time it was given." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>What needs doing</th><th>Centre</th><th>Priority</th><th>Due</th>
                  <th>Days over</th><th>Centre says</th><th>Raised by</th><th></th>
                </tr>
              </thead>
              <tbody>
                {overdue.map((s) => (
                  <tr key={s.id}>
                    <td className="max-w-[280px] font-medium">{s.title}</td>
                    <td className="text-[var(--muted)]">{s.center_name}</td>
                    <td>
                      <Badge tone={s.priority === "critical" ? "bad" : s.priority === "high" ? "warn" : "mute"}>
                        {PRIORITY_LABEL[s.priority as keyof typeof PRIORITY_LABEL] ?? s.priority}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-[var(--muted)]">{fmtDate(s.due_on)}</td>
                    <td className="tabular-nums text-[var(--bad)]">{s.days_over}</td>
                    <td className="text-[12.5px] text-[var(--muted)]">
                      {SUGGESTION_STATUS_LABEL[s.status as keyof typeof SUGGESTION_STATUS_LABEL] ?? s.status}
                      {s.replies > 0 && ` · ${s.replies} repl${s.replies === 1 ? "y" : "ies"}`}
                    </td>
                    <td className="text-[var(--muted)]">{s.auditor ?? "—"}</td>
                    <td>
                      <Link href={`/audits/suggestions/${s.id}`} className="btn btn-ghost btn-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
