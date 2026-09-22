import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { BarChart, ChartFrame, LineChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { isGlobalRole } from "@/lib/roles";
import { periodOf, trends, unknownAdmissions, type Period } from "@/lib/trends";

export const metadata = { title: "Trends · Pehchaan" };

const PERIODS: { value: Period; label: string; span: string }[] = [
  { value: "month", label: "Monthly", span: "the last 24 months" },
  { value: "quarter", label: "Quarterly", span: "academic quarters (Q1 Apr–Jun … Q4 Jan–Mar)" },
  { value: "year", label: "Yearly", span: "academic years, April to March" },
];

/**
 * Admissions, attendance and PTMs over time — one measure per chart, each on
 * its own axis, since a count of children and a percentage share no scale.
 */
export default async function TrendsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("statistics");
  const sp = await searchParams;
  const period = periodOf(sp.period);
  const centerId = resolveCenterId(user, sp.center);
  const [centers, rows, unknown] = await Promise.all([
    centersForUser(user), trends(centerId, period), unknownAdmissions(centerId),
  ]);

  const pct = (r: { present: number; marked: number }) =>
    r.marked > 0 ? Math.round((r.present / r.marked) * 1000) / 10 : null;
  // attendance is a rate: a period with no register marked has no rate at all,
  // so it is left off the line rather than drawn as a fall to zero
  const attendance = rows
    .filter((r) => r.marked > 0)
    .map((r) => ({ label: r.label, value: pct(r)!, hint: `${r.present} of ${r.marked} marks present` }));

  const totalAdm = rows.reduce((n, r) => n + r.admissions, 0);
  const totalPtm = rows.reduce((n, r) => n + r.ptms, 0);
  const marked = rows.reduce((n, r) => n + r.marked, 0);
  const present = rows.reduce((n, r) => n + r.present, 0);
  const span = PERIODS.find((p) => p.value === period)!.span;
  const every = rows.length > 16 ? Math.ceil(rows.length / 12) : 1;
  const link = (p: Period) => {
    const q = new URLSearchParams();
    if (sp.center) q.set("center", sp.center);
    q.set("period", p);
    return `/statistics/trends?${q.toString()}`;
  };

  return (
    <>
      <PageHeader title="Trends"
        subtitle={`Admissions, attendance and PTMs over time · ${span}`}
        right={<Link href="/statistics" className="btn btn-ghost btn-sm">Statistics</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Link key={p.value} href={link(p.value)} scroll={false}
            className={`btn btn-sm ${period === p.value ? "btn-primary" : "btn-ghost"}`}>
            {p.label}
          </Link>
        ))}
      </div>

      <Filters centers={isGlobalRole(user.role) ? centers : []} current={sp} />

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Admissions" value={totalAdm} hint={`over ${span.replace(/ \(.*/, "")}`} />
        <StatCard label="Attendance"
          value={marked ? `${Math.round((present / marked) * 1000) / 10}%` : "—"}
          hint={`${marked.toLocaleString("en-IN")} register marks`} />
        <StatCard label="PTMs held" value={totalPtm} hint="parent interactions recorded" />
      </div>

      <div className="mt-5 grid gap-5">
        <ChartFrame
          title="Admissions"
          subtitle={`Children admitted in each ${period}${unknown
            ? ` · ${unknown} imported without an admission date are left out` : ""}`}
          empty={totalAdm === 0}
          table={{ head: ["Period", "Admissions"], rows: rows.map((r) => [r.label, r.admissions]) }}
        >
          <BarChart data={rows.map((r) => ({ label: r.label, value: r.admissions }))}
            color={SERIES[0]} labelEvery={every} valueLabels={rows.length > 12 ? "key" : "all"} />
        </ChartFrame>

        <ChartFrame
          title="Attendance"
          subtitle={`Share of register marks that were present, late or half day, each ${period}`}
          empty={attendance.length === 0}
          table={{ head: ["Period", "Attendance %", "Present", "Marked"],
            rows: rows.filter((r) => r.marked > 0)
              .map((r) => [r.label, `${pct(r)}%`, r.present, r.marked]) }}
        >
          <LineChart data={attendance} color={SERIES[0]} yMax={100} suffix="%" />
        </ChartFrame>

        <ChartFrame
          title="PTMs"
          subtitle={`Parent interactions recorded in each ${period}`}
          empty={totalPtm === 0}
          table={{ head: ["Period", "PTMs"], rows: rows.map((r) => [r.label, r.ptms]) }}
        >
          <BarChart data={rows.map((r) => ({ label: r.label, value: r.ptms }))}
            color={SERIES[0]} labelEvery={every} valueLabels={rows.length > 12 ? "key" : "all"} />
        </ChartFrame>
      </div>
    </>
  );
}
