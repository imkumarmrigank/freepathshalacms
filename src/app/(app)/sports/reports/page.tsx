import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";
import { sportsReports } from "@/lib/day-book";

export const metadata = { title: "Sports reports · Pehchaan" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * What the sports teachers filed, day by day: the visit report the app asks
 * for, and the remarks they wrote at the end of the day, side by side.
 */
export default async function SportsReportsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("sports");
  if (!isGlobalRole(user.role) || user.role === "sports_teacher") redirect("/sports");
  const sp = await searchParams;

  const now = today();
  const from = sp.from || addDays(now, -29);
  const to = sp.to || now;
  const centerId = resolveCenterId(user, sp.center);
  const pg = pageFrom(sp, 25);

  const [rows, centers, teachers] = await Promise.all([
    sportsReports({
      from, to, centerId,
      teacherId: sp.who ? Number(sp.who) : null,
      limit: pg.size, offset: pg.offset,
    }),
    centersForUser(user),
    query<{ id: number; name: string }>(
      `SELECT id, name FROM users WHERE role = 'sports_teacher'
        ORDER BY is_active DESC, name`),
  ]);

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);
  const children = rows.reduce((n, r) => n + (r.children_count ?? 0), 0);
  const unfiled = rows.filter((r) => !r.report_submitted_at).length;
  const withNotes = rows.filter((r) => r.note_summary).length;

  return (
    <>
      <PageHeader title="Sports reports"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · visit reports and the day's remarks`}
        right={
          <>
            <Link href="/sports/daily" className="btn btn-ghost btn-sm">Day book</Link>
            <Link href="/reports?report=sports-visits" className="btn btn-ghost btn-sm">
              Download
            </Link>
          </>
        } />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        dates
        extra={[{ name: "who", label: "Every sports teacher",
          options: teachers.map((t) => ({ value: t.id, label: t.name })) }]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visits" value={total} hint={`on this page: ${rows.length}`} />
        <StatCard label="Children seen" value={children} hint="on the visits shown" />
        <StatCard label="Reports not filed" value={unfiled}
          tone={unfiled > 0 ? "warn" : "ok"} />
        <StatCard label="Days also written up" value={withNotes}
          hint="the teacher's own remarks" />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No sports visits in this period"
            hint="A visit appears here as soon as a sports teacher checks in at a centre." />
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium">{fmtDate(r.visit_date)}</span>
                  <span className="text-[13px] text-[var(--muted)]">{r.center_name}</span>
                  <span className="text-[13px] text-[var(--muted)]">· {r.teacher ?? "—"}</span>
                  {r.check_in && (
                    <span className="text-[12.5px] text-[var(--faint)]">
                      {r.check_in}–{r.check_out ?? "…"}
                      {r.worked_minutes != null && ` · ${Math.floor(r.worked_minutes / 60)}h ${r.worked_minutes % 60}m`}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    {r.children_count != null && (
                      <span className="text-[13px] tabular-nums">{r.children_count} children</span>
                    )}
                    {r.report_submitted_at
                      ? <Badge tone="ok">Report filed</Badge>
                      : <Badge tone="warn">No report</Badge>}
                    {r.closed_late && <Badge tone="warn">Filed late</Badge>}
                  </span>
                </div>

                <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-[13.5px] sm:grid-cols-2">
                  {r.sports_covered && (
                    <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Sports</dt>
                      <dd>{r.sports_covered}</dd></div>
                  )}
                  {r.activities && (
                    <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Activities</dt>
                      <dd>{r.activities}</dd></div>
                  )}
                  {r.highlights && (
                    <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Highlights</dt>
                      <dd>{r.highlights}</dd></div>
                  )}
                  {r.issues && (
                    <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Issues</dt>
                      <dd className="text-[#b45309]">{r.issues}</dd></div>
                  )}
                </dl>

                {(r.note_summary || r.note_equipment || r.note_talent || r.note_injuries) && (
                  <div className="mt-2.5 rounded-[9px] bg-[#f7f7fb] px-3.5 py-2.5">
                    <div className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">
                      In their own words, that day
                    </div>
                    <dl className="mt-1 space-y-1 text-[13px]">
                      {r.note_summary && <dd>{r.note_summary}</dd>}
                      {r.note_equipment && (
                        <div><dt className="inline text-[var(--muted)]">Equipment needed: </dt>
                          <dd className="inline text-[#b45309]">{r.note_equipment}</dd></div>
                      )}
                      {r.note_talent && (
                        <div><dt className="inline text-[var(--muted)]">Worth following: </dt>
                          <dd className="inline">{r.note_talent}</dd></div>
                      )}
                      {r.note_injuries && (
                        <div><dt className="inline text-[var(--muted)]">Anything that happened: </dt>
                          <dd className="inline">{r.note_injuries}</dd></div>
                      )}
                    </dl>
                  </div>
                )}
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
