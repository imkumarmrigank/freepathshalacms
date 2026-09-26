import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";
import { dayBookPeople, mentorDays } from "@/lib/day-book";

export const metadata = { title: "Mentor day book · Pehchaan" };

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
 * What each mentor did, day by day: meetings written up and which dates they
 * belong to, children referred, counselling steps taken, centre feedback
 * left. Read by the day the work was entered — the day the mentor actually
 * sat down — with the meeting dates shown beside it.
 */
export default async function MentorDayBookPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("ptm");
  if (!isGlobalRole(user.role) && user.role !== "center_manager") redirect("/ptm");
  const sp = await searchParams;

  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const now = today();
  const from = sp.from || addDays(now, -(days - 1));
  const to = sp.to || now;
  const centerId = resolveCenterId(user, sp.center);

  const [centers, people] = await Promise.all([
    centersForUser(user), dayBookPeople("mentor"),
  ]);
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const rows = await mentorDays(from, to, centerId, who);

  const totals = rows.reduce((t, r) => ({
    written: t.written + r.written_up,
    flags: t.flags + r.flags_raised,
    steps: t.steps + r.counselling_steps,
    feedback: t.feedback + r.feedback,
  }), { written: 0, flags: 0, steps: 0, feedback: 0 });
  const workingDays = new Set(rows.map((r) => r.day)).size;

  return (
    <>
      <PageHeader title="Mentor day book"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · what each mentor did, day by day`}
        right={
          <>
            <Link href="/ptm/dashboard" className="btn btn-ghost btn-sm">PTM dashboard</Link>
            <Link href="/reports?report=mentor-daily" className="btn btn-ghost btn-sm">
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
          { name: "who", label: "Every mentor",
            options: people.map((p) => ({
              value: p.id, label: p.is_active ? p.name : `${p.name} (inactive)` })) },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Meetings written up" value={totals.written}
          hint={`over ${workingDays} day${workingDays === 1 ? "" : "s"} of work`} />
        <StatCard label="Children referred" value={totals.flags}
          tone={totals.flags > 0 ? "warn" : "default"} />
        <StatCard label="Counselling steps" value={totals.steps}
          hint="picked up, followed up or closed" />
        <StatCard label="Centre feedback" value={totals.feedback} />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No mentor work in this period"
            hint="Nothing was written up, referred or followed up between these dates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th><th>Mentor</th><th>Written up</th><th>Meetings belong to</th>
                  <th>Centres</th><th>Children</th><th>Follow-ups promised</th>
                  <th>Referrals</th><th>Counselling steps</th><th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.day}-${r.mentor_id}-${i}`}>
                    <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
                    <td>{r.mentor}</td>
                    <td className="tabular-nums">
                      {r.written_up || "—"}
                      {r.met_today > 0 && r.met_today !== r.written_up && (
                        <div className="text-[12px] text-[var(--muted)]">
                          {r.met_today} held that day
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[13px]">
                      {r.meeting_dates === 0 ? <span className="text-[var(--faint)]">—</span>
                        : r.meeting_dates === 1 && r.oldest_meeting === r.day
                          ? <span className="text-[var(--muted)]">the same day</span>
                          : <>
                              <span className="text-[var(--muted)]">
                                {r.meeting_dates} date{r.meeting_dates === 1 ? "" : "s"}
                              </span>
                              {r.oldest_meeting && r.oldest_meeting < r.day && (
                                <div className="mt-0.5">
                                  <Badge tone="warn">back to {fmtDate(r.oldest_meeting)}</Badge>
                                </div>
                              )}
                            </>}
                    </td>
                    <td className="max-w-[200px] text-[13px] text-[var(--muted)]">
                      {r.centres ?? "—"}
                    </td>
                    <td className="tabular-nums text-[var(--muted)]">{r.children || "—"}</td>
                    <td className="tabular-nums">{r.follow_ups_promised || "—"}</td>
                    <td className="tabular-nums">{r.flags_raised || "—"}</td>
                    <td className="tabular-nums">{r.counselling_steps || "—"}</td>
                    <td className="tabular-nums text-[var(--muted)]">{r.feedback || "—"}</td>
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
