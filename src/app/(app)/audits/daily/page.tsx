import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { canScheduleVisits, isGlobalRole } from "@/lib/roles";
import { auditorDays, dayBookPeople } from "@/lib/day-book";
import AuditorRows from "./AuditorRows";

export const metadata = { title: "Auditor day book · Pehchaan" };

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
 * What each auditor did, day by day: visits filed, suggestions raised,
 * replies written, claims verified. Read by the day the work was entered,
 * so a day at the keyboard writing up last week's visits is a day's work
 * here rather than a blank.
 */
export default async function AuditorDayBookPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (!canScheduleVisits(user.role)) redirect("/audits");
  const sp = await searchParams;

  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const now = today();
  const from = sp.from || addDays(now, -(days - 1));
  const to = sp.to || now;
  const centerId = resolveCenterId(user, sp.center);

  const [centers, people] = await Promise.all([
    centersForUser(user), dayBookPeople("auditor"),
  ]);
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const rows = await auditorDays(from, to, centerId, who);

  const totals = rows.reduce((t, r) => ({
    visits: t.visits + r.visits_filed,
    suggestions: t.suggestions + r.suggestions,
    replies: t.replies + r.replies,
    verified: t.verified + r.verified,
  }), { visits: 0, suggestions: 0, replies: 0, verified: 0 });
  const workingDays = new Set(rows.map((r) => r.day)).size;

  return (
    <>
      <PageHeader title="Auditor day book"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · what each auditor did, day by day`}
        right={
          <>
            <Link href="/audits/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
            <Link href="/reports?report=auditor-daily" className="btn btn-ghost btn-sm">
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
          { name: "who", label: "Every auditor",
            options: people.map((p) => ({
              value: p.id, label: p.is_active ? p.name : `${p.name} (inactive)` })) },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visits filed" value={totals.visits}
          hint={`over ${workingDays} day${workingDays === 1 ? "" : "s"} of work`} />
        <StatCard label="Suggestions raised" value={totals.suggestions} />
        <StatCard label="Replies written" value={totals.replies} />
        <StatCard label="Claims verified" value={totals.verified}
          tone={totals.verified > 0 ? "ok" : "default"} />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No auditor work in this period"
            hint="Nothing was filed, raised, answered or verified between these dates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th><th>Auditor</th><th>Visits filed</th><th>Centres</th>
                  <th>Children seen</th><th>Average score</th>
                  <th>Suggestions</th><th>Replies</th><th>Verified</th><th>Visits booked</th>
                </tr>
              </thead>
              <AuditorRows rows={rows} centerId={centerId} />
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
