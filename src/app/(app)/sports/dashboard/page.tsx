import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { BarChart, ChartFrame, HBarChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { fmtDate, minutesToHours, today } from "@/lib/format";
import { isGlobalRole } from "@/lib/roles";
import Filters from "@/components/Filters";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { SPECIAL_LEVEL_LABEL, SPECIAL_LEVEL_TONE } from "@/lib/sports-meta";
import {
  sportsHeadline, sportsRundown, sportsTalentList, sportsTeacherDays, sportsTeachers,
  sportsTurnout, sportsVisitsOn,
} from "@/lib/sports-dashboard";

export const metadata = { title: "Sports dashboard · Pehchaan" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/**
 * Sport across every centre, for the office: what is running, who plays,
 * whether they turn up, what the sports teacher did today, and which
 * children have a gift worth acting on.
 */
export default async function SportsDashboardPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("sports");
  // the sports teacher's own screen is the centre they are standing in
  if (!isGlobalRole(user.role) || user.role === "sports_teacher") redirect("/sports");
  const sp = await searchParams;
  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 30;
  const now = today();
  const from = addDays(now, -(days - 1));
  const day = sp.day && sp.day <= now ? sp.day : now;

  const [people, centers] = await Promise.all([sportsTeachers(), centersForUser(user)]);
  const centerId = resolveCenterId(user, sp.center);
  // "whose work?" — with several sports teachers, the office reads one at a time
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const whoName = people.find((p) => p.id === who)?.name;

  const [head, rundown, teachers, visits, turnout, talent] = await Promise.all([
    sportsHeadline(from, now, who, centerId), sportsRundown(from, now, who, centerId),
    sportsTeacherDays(from, now, who), sportsVisitsOn(day, who, centerId),
    sportsTurnout(addDays(now, -13), now, who, centerId), sportsTalentList(centerId),
  ]);

  const n = (v: string | null | undefined) => Number(v ?? 0);
  const marked = n(head?.marked);
  const turnoutPct = marked ? Math.round((n(head?.present) / marked) * 1000) / 10 : null;
  const quiet = rundown.filter((r) => r.is_active && r.sessions === 0);
  /** Every link keeps the filters already chosen. */
  const link = (over: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | null> = {
      days: String(days), who: who ? String(who) : null,
      center: sp.center ?? null, day: day === now ? null : day, ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/sports/dashboard?${q.toString()}`;
  };

  return (
    <>
      <PageHeader title="Sports dashboard"
        subtitle={whoName
          ? `${whoName}'s work — visits, registers and tests`
          : "Every centre's sport, and the sports teacher's day"}
        right={<Link href="/sports" className="btn btn-ghost btn-sm">Sports by centre</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {people.length > 1 && (
          <span className="mr-1 inline-flex flex-wrap gap-2">
            <Link href={link({ days: String(days), who: null })} scroll={false}
              className={`btn btn-sm ${who === null ? "btn-primary" : "btn-ghost"}`}>
              Everyone
            </Link>
            {people.map((p) => (
              <Link key={p.id} href={link({ days: String(days), who: String(p.id) })} scroll={false}
                className={`btn btn-sm ${who === p.id ? "btn-primary" : "btn-ghost"}`}>
                {p.name}
              </Link>
            ))}
            <span className="mx-1 self-center text-[var(--border-strong)]">|</span>
          </span>
        )}
        {RANGES.map((r) => (
          <Link key={r.value}
            href={link({ days: r.value })} scroll={false}
            className={`btn btn-sm ${String(days) === r.value ? "btn-primary" : "btn-ghost"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <Filters centers={centers} current={sp} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={whoName ? "Sports running (all)" : "Sports running"} value={n(head?.sports)}
          hint={`at ${n(head?.centres)} centre${n(head?.centres) === 1 ? "" : "s"}`} />
        <StatCard label="Children playing" value={n(head?.players)}
          hint={`${n(head?.special)} marked as talented`} />
        <StatCard label="Turnout" value={turnoutPct === null ? "—" : `${turnoutPct}%`}
          hint={`${n(head?.sessions)} sessions · ${marked.toLocaleString("en-IN")} marks`}
          tone={turnoutPct !== null && turnoutPct < 60 ? "warn" : "default"} />
        <StatCard label="Centre visits" value={n(head?.visits)}
          hint={`${n(head?.tests)} test${n(head?.tests) === 1 ? "" : "s"} taken`} />
      </div>

      {/* --------------------------------------- the sports teacher's day */}
      <div className="label-cap mb-2.5 mt-6">
        Visits on {fmtDate(day)}
        <Link href={link({ day: addDays(day, -1) })}
          className="ml-2 text-[12px] font-normal text-[var(--brand)] hover:underline">← day before</Link>
        {day < now && (
          <Link href={link({ day: addDays(day, 1) })}
            className="ml-2 text-[12px] font-normal text-[var(--brand)] hover:underline">day after →</Link>
        )}
      </div>
      <Card pad={false}>
        {visits.length === 0 ? (
          <Empty title="No centre visited that day"
            hint="A sports teacher checks in at each centre and files a report before leaving." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Sports teacher</th><th>Centre</th><th>In</th><th>Out</th><th>Time there</th>
                  <th>Sports played</th><th>Children</th><th>What was done</th><th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.teacher}</td>
                    <td className="text-[var(--muted)]">{v.center_name}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">{v.check_in}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {v.check_out ?? (v.submitted
                        ? <span className="text-[var(--faint)]">not recorded</span>
                        : <Badge tone="warn">still there</Badge>)}
                    </td>
                    <td className="whitespace-nowrap">{minutesToHours(v.minutes)}</td>
                    <td className="text-[12.5px] text-[var(--muted)]">
                      {v.sports_covered.length ? v.sports_covered.join(", ") : "—"}
                    </td>
                    <td className="tabular-nums">{v.children_count ?? "—"}</td>
                    <td className="max-w-[300px] text-[12.5px]">{v.activities ?? <span className="text-[var(--faint)]">report not submitted</span>}</td>
                    <td className="max-w-[220px] text-[12.5px] text-[var(--muted)]">{v.issues ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame title="Turnout over the last fortnight"
          subtitle="Children present at sports each day"
          empty={turnout.every((t) => t.marked === 0)}
          table={{ head: ["Day", "Present", "Marked"],
            rows: turnout.filter((t) => t.marked > 0)
              .map((t) => [fmtDate(t.day), t.present, t.marked]) }}>
          <BarChart data={turnout.map((t) => ({
            label: t.day.slice(8) + "/" + t.day.slice(5, 7), value: t.present,
            hint: t.marked ? `${t.present} of ${t.marked} marked` : undefined,
          }))} color={SERIES[0]} valueLabels="key" labelEvery={2} />
        </ChartFrame>

        <ChartFrame title="Children playing, by sport"
          subtitle="Every sport on the books"
          empty={rundown.length === 0}
          table={{ head: ["Sport", "Centre", "Players", "Sessions", "Turnout %", "Tests"],
            rows: rundown.map((r) => [r.sport, r.center_name, r.players, r.sessions,
              r.marked ? `${Math.round((r.present / r.marked) * 100)}%` : "—", r.tests]) }}>
          <HBarChart data={rundown.filter((r) => r.is_active).map((r) => ({
            label: `${r.sport} · ${r.center_name}`, value: r.players,
          }))} color={SERIES[2]} />
        </ChartFrame>
      </div>

      {/* --------------------------------------------------- sport by sport */}
      <div className="label-cap mb-2.5 mt-6">
        Every sport
        {quiet.length > 0 && (
          <span className="ml-2 font-normal text-[var(--warn)]">
            {quiet.length} with no session in the last {days} days
          </span>
        )}
      </div>
      <Card pad={false}>
        {rundown.length === 0 ? (
          <Empty title="No sports yet"
            hint="A sports teacher adds a sport at the centre they are visiting." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Sport</th><th>Centre</th><th>Players</th><th>Talented</th>
                  <th>Sessions</th><th>Turnout</th><th>Tests</th><th>Last session</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rundown.map((r) => (
                  <tr key={r.id} className={r.is_active ? "" : "opacity-60"}>
                    <td className="font-medium">
                      {r.sport}{!r.is_active && <Badge tone="mute">Paused</Badge>}
                    </td>
                    <td className="text-[var(--muted)]">{r.center_name}</td>
                    <td className="tabular-nums">{r.players}</td>
                    <td className="tabular-nums">{r.special || "—"}</td>
                    <td className="tabular-nums">{r.sessions}</td>
                    <td className="tabular-nums">
                      {r.marked ? `${Math.round((r.present / r.marked) * 100)}%` : "—"}
                    </td>
                    <td className="tabular-nums">{r.tests}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {r.last_session ? fmtDate(r.last_session)
                        : <span className="text-[var(--faint)]">never</span>}
                    </td>
                    <td><Link href={`/sports/${r.id}`} className="btn btn-ghost btn-sm">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------------------------------------------------------- talent */}
      <div className="label-cap mb-2.5 mt-6">Children with a gift</div>
      <Card pad={false}>
        {talent.length === 0 ? (
          <Empty title="Nobody marked yet"
            hint="A sports teacher marks a child on the sport's Talent tab." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Child</th><th>Centre</th><th>Sport</th><th>Talent</th>
                  <th>Could go to</th><th>Turnout</th></tr>
              </thead>
              <tbody>
                {talent.map((t) => (
                  <tr key={`${t.student_id}-${t.sport}`}>
                    <td>
                      <Link href={`/students/${t.student_id}`} className="font-medium hover:underline">
                        {t.student}
                      </Link>
                      <div className="font-mono text-[11px] text-[var(--faint)]">{t.enrollment_no}</div>
                    </td>
                    <td className="text-[var(--muted)]">{t.center_name}</td>
                    <td className="text-[var(--muted)]">{t.sport}</td>
                    <td className="max-w-[260px] text-[13px]">{t.speciality ?? "—"}</td>
                    <td>
                      {t.special_level && (
                        <Badge tone={SPECIAL_LEVEL_TONE[t.special_level]}>
                          {SPECIAL_LEVEL_LABEL[t.special_level]}
                        </Badge>
                      )}
                    </td>
                    <td className="tabular-nums">
                      {t.marked ? `${Math.round((t.present / t.marked) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------- who does the work */}
      <div className="label-cap mb-2.5 mt-6">Sports teachers over the last {days} days</div>
      <Card pad={false}>
        {teachers.length === 0 ? (
          <Empty title="No sports teacher yet"
            hint="Add one under Administration → Staff with the Sports Teacher role." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Sports teacher</th><th>Days out</th><th>Centre visits</th><th>Centres</th>
                  <th>Hours at centres</th><th>Children taught</th><th>Reports missing</th>
                  <th>Last visit</th></tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.user_id}>
                    <td className="font-medium">{t.teacher}</td>
                    <td className="tabular-nums">{t.days}</td>
                    <td className="tabular-nums">{t.visits}</td>
                    <td className="tabular-nums text-[var(--muted)]">{t.centres}</td>
                    <td className="whitespace-nowrap">{minutesToHours(t.minutes)}</td>
                    <td className="tabular-nums">{t.children ?? "—"}</td>
                    <td className={`tabular-nums ${t.pending ? "text-[var(--bad)]" : ""}`}>{t.pending}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {t.last_visit ? fmtDate(t.last_visit) : "never"}
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
