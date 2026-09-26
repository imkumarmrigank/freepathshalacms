import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";
import { dayBookPeople, sportsDays } from "@/lib/day-book";
import SportsRows from "./SportsRows";

export const metadata = { title: "Sports day book · Pehchaan" };

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * What each sports teacher did, day by day: centres visited, attendance
 * marked, tests set and marked, remarks written on children. The visit is
 * dated by the day it was made; everything else by the day it was entered.
 */
export default async function SportsDayBookPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("sports");
  // the sports teacher's own screen is the centre they are standing in
  if (!isGlobalRole(user.role) || user.role === "sports_teacher") redirect("/sports");
  const sp = await searchParams;

  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const now = today();
  const from = sp.from || addDays(now, -(days - 1));
  const to = sp.to || now;
  const centerId = resolveCenterId(user, sp.center);

  const [centers, people] = await Promise.all([
    centersForUser(user), dayBookPeople("sports_teacher"),
  ]);
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const rows = await sportsDays(from, to, centerId, who);

  const totals = rows.reduce((t, r) => ({
    visits: t.visits + r.visits,
    children: t.children + r.children_seen,
    sessions: t.sessions + r.sessions,
    unfiled: t.unfiled + (r.visits - r.reports_filed),
  }), { visits: 0, children: 0, sessions: 0, unfiled: 0 });
  const workingDays = new Set(rows.map((r) => r.day)).size;

  return (
    <>
      <PageHeader title="Sports day book"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · what each sports teacher did, day by day`}
        right={
          <>
            <Link href="/sports/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
            <Link href="/reports?report=sports-daily" className="btn btn-ghost btn-sm">
              Download
            </Link>
          </>
        } />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        dates
        extra={[
          { name: "days", label: "Last 30 days", options: RANGES },
          { name: "who", label: "Every sports teacher",
            options: people.map((p) => ({
              value: p.id, label: p.is_active ? p.name : `${p.name} (inactive)` })) },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Centre visits" value={totals.visits}
          hint={`over ${workingDays} day${workingDays === 1 ? "" : "s"} of work`} />
        <StatCard label="Children seen" value={totals.children} />
        <StatCard label="Sessions marked" value={totals.sessions}
          hint="a sport's register for a day" />
        <StatCard label="Visits with no report" value={totals.unfiled}
          tone={totals.unfiled > 0 ? "warn" : "ok"} />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No sports work in this period"
            hint="No visit, register, test or remark was entered between these dates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th><th>Sports teacher</th><th>Visits</th><th>Centres</th>
                  <th>Children seen</th><th>Time at centres</th>
                  <th>Sessions marked</th><th>Tests set</th><th>Marks entered</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <SportsRows rows={rows} centerId={centerId} />
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
