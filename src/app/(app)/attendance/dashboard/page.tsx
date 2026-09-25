import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import FlagMark from "@/components/FlagMark";
import { BarChart, ChartFrame, HBarChart, StackedBarChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, currentSession, resolveCenterId } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";
import {
  absenceReasons, attendanceByCentre, attendanceByClass, attendanceByDay,
  attendanceHeadline, mostAbsent, unmarkedToday,
} from "@/lib/attendance-dashboard";

export const metadata = { title: "Attendance dashboard · Pehchaan" };

const SPLIT = [
  { key: "present", label: "Present", color: SERIES[2] },
  { key: "absent", label: "Absent", color: SERIES[1] },
];

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** Pure date arithmetic on a date string — not a "now", so it stays in UTC. */
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The register, read as a whole: how many are coming, on which days, why the
 * rest are away, and which children the absence is concentrated in.
 *
 * A teacher sees their own centre and nothing else — the centre is fixed for
 * them, exactly as it is on the register itself.
 */
export default async function AttendanceDashboardPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("attendance");
  const sp = await searchParams;
  const [centers, session] = await Promise.all([centersForUser(user), currentSession()]);
  if (!session) {
    return (
      <>
        <PageHeader title="Attendance dashboard" subtitle="How the register is going" />
        <Card><Empty title="No academic session is open"
          hint="An administrator opens the session before attendance can be read." /></Card>
      </>
    );
  }

  const centerId = resolveCenterId(user, sp.center);
  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const now = today();
  const from = addDays(now, -(days - 1));
  const wide = isGlobalRole(user.role) && !centerId;

  const [head, byDay, reasons, byCentre, byClass, worst, unmarked] = await Promise.all([
    attendanceHeadline(session.id, centerId, from, now, now),
    attendanceByDay(session.id, centerId, from, now),
    absenceReasons(session.id, centerId, from, now),
    attendanceByCentre(session.id, centerId, from, now),
    attendanceByClass(session.id, centerId, from, now),
    mostAbsent(session.id, centerId, from, now),
    unmarkedToday(session.id, centerId, now),
  ]);

  const markedToday = head?.marked_today ?? 0;
  const roll = head?.roll ?? 0;
  const notMarked = unmarked.reduce((n, r) => n + r.children, 0);
  const todayPct = markedToday
    ? Math.round(((head?.present_today ?? 0) / markedToday) * 100) : null;
  const scope = centerId
    ? centers.find((c) => c.id === centerId)?.name ?? "your centre"
    : "every centre";

  return (
    <>
      <PageHeader title="Attendance dashboard"
        subtitle={`${scope} · session ${session.name}`}
        right={<Link href="/attendance" className="btn">Mark the register</Link>} />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        extra={[{ name: "days", label: "Last 30 days", options: RANGES }]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present today" value={head?.present_today ?? 0}
          hint={markedToday ? `${todayPct}% of the ${markedToday} marked` : "nothing marked yet"}
          tone={todayPct == null ? "default" : todayPct >= 75 ? "ok" : todayPct >= 50 ? "warn" : "bad"} />
        <StatCard label="Absent today" value={head?.absent_today ?? 0}
          hint={`${roll} children on the roll`}
          tone={(head?.absent_today ?? 0) > (head?.present_today ?? 0) ? "bad" : "default"} />
        <StatCard label="Still to mark today" value={notMarked}
          hint={notMarked
            ? `${unmarked.length} register${unmarked.length === 1 ? "" : "s"} not filled in`
            : "every register is in"}
          tone={notMarked ? "warn" : "ok"} />
        <StatCard label={`Attendance · last ${days} days`}
          value={head?.pct == null ? "—" : `${head.pct}%`}
          hint={`${head?.present ?? 0} present of ${(head?.present ?? 0) + (head?.absent ?? 0)} marks`}
          tone={head?.pct == null ? "default" : head.pct >= 75 ? "ok" : head.pct >= 60 ? "warn" : "bad"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame title={`Day by day · last ${days} days`}
          subtitle="Children present and absent on each day the register was marked"
          series={SPLIT}
          empty={byDay.length === 0}
          table={{ head: ["Day", "Present", "Absent", "Attendance"],
            rows: byDay.map((d) => [fmtDate(d.day), d.present, d.absent,
              d.pct == null ? "—" : `${d.pct}%`]) }}>
          <StackedBarChart series={SPLIT}
            data={byDay.map((d) => ({
              label: `${d.day.slice(8)}/${d.day.slice(5, 7)}`,
              parts: { present: d.present, absent: d.absent },
            }))} />
        </ChartFrame>

        <ChartFrame title="Why children were away"
          subtitle={`Reasons given over the last ${days} days · the register asks for one on every absence`}
          empty={reasons.length === 0}
          table={{ head: ["Reason", "Days", "Children"],
            rows: reasons.map((r) => [r.reason, r.n, r.children]) }}>
          <HBarChart color={SERIES[1]} labelWidth={150}
            data={reasons.map((r) => ({
              label: r.reason, value: r.n,
              hint: `${r.children} child${r.children === 1 ? "" : "ren"}`,
            }))} />
        </ChartFrame>

        {wide && (
          <ChartFrame title="Centre by centre"
            subtitle={`Share of marks that were present · last ${days} days · weakest first`}
            empty={byCentre.length === 0}
            table={{ head: ["Centre", "On the roll", "Present", "Absent", "Attendance", "Days marked"],
              rows: byCentre.map((c) => [c.center_name, c.roll, c.present, c.absent,
                c.pct == null ? "—" : `${c.pct}%`, c.days]) }}>
            <HBarChart color={SERIES[0]} suffix="%" labelWidth={130}
              data={byCentre.map((c) => ({
                label: c.center_name, value: c.pct ?? 0,
                hint: `${c.present} present of ${c.present + c.absent} · ${c.roll} on roll`,
              }))} />
          </ChartFrame>
        )}

        <ChartFrame title="Class by class"
          subtitle={`Share present, last ${days} days`}
          empty={byClass.length === 0}
          table={{ head: ["Class", "Present", "Absent", "Attendance"],
            rows: byClass.map((c) => [c.class_name, c.present, c.absent,
              c.pct == null ? "—" : `${c.pct}%`]) }}>
          <BarChart color={SERIES[3]} suffix="%" valueLabels="key"
            data={byClass.map((c) => ({
              label: c.class_name.replace("Class ", ""), value: c.pct ?? 0,
              hint: `${c.present} present of ${c.present + c.absent}`,
            }))} />
        </ChartFrame>
      </div>

      {/* ------------------------------------------- the children behind it */}
      <div className="label-cap mb-2.5 mt-6">
        Children missing the most · last {days} days
      </div>
      <Card pad={false}>
        {worst.length === 0 ? (
          <Empty title="Nobody has missed a day"
            hint="Every child marked in this period was present each time." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  {!centerId && <th>Centre</th>}
                  <th>Class</th><th>Days away</th><th>Attendance</th>
                  <th>Reasons given</th>
                </tr>
              </thead>
              <tbody>
                {worst.map((r) => (
                  <tr key={r.student_id}>
                    <td>
                      <Link href={`/students/${r.student_id}`}
                        className="font-medium hover:text-[var(--brand)]">{r.student}</Link>
                      <FlagMark status={r.flag_status} urgency={r.flag_urgency}
                        raisedOn={r.flag_on} />
                      <div className="font-mono text-[11px] text-[var(--faint)]">
                        {r.enrollment_no}
                      </div>
                    </td>
                    {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                    <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    <td className="tabular-nums">
                      {r.days_absent}
                      <span className="text-[12px] text-[var(--muted)]"> of {r.days_marked}</span>
                    </td>
                    <td>
                      <Badge tone={(r.pct ?? 0) >= 75 ? "ok" : (r.pct ?? 0) >= 50 ? "warn" : "bad"}>
                        {r.pct ?? 0}%
                      </Badge>
                    </td>
                    <td className="max-w-[320px] text-[13px] text-[var(--muted)]">
                      {r.reasons ?? <span className="text-[var(--faint)]">none given</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ today's chase list */}
      {unmarked.length > 0 && (
        <>
          <div className="label-cap mb-2.5 mt-6">
            Registers not marked today · {fmtDate(now)}
          </div>
          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Centre</th><th>Class</th><th>Children waiting</th><th></th></tr>
                </thead>
                <tbody>
                  {unmarked.map((r, i) => (
                    <tr key={i}>
                      <td className="font-medium">{r.center_name}</td>
                      <td className="text-[var(--muted)]">{r.class_name}</td>
                      <td className="tabular-nums">{r.children}</td>
                      <td>
                        <Link href="/attendance" className="btn btn-ghost btn-sm">
                          Open the register
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
