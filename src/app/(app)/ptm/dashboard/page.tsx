import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import FlagMark from "@/components/FlagMark";
import SiblingMark from "@/components/SiblingMark";
import { ChartFrame, HBarChart, StackedBarChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { fmtDate, today, titleCase } from "@/lib/format";
import { isGlobalRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { engagementLabel, modeLabel, parentLabel } from "@/lib/ptm-meta";
import {
  ptmAbsentees, ptmByCentre, ptmCommitments, ptmConcerns, ptmDay, ptmDayCoverage,
  ptmInteractionsOn, ptmMissedDays, ptmPeople, ptmPerDay, ptmScheduled,
} from "@/lib/ptm-dashboard";

export const metadata = { title: "PTM dashboard · Pehchaan" };

/** Pure date arithmetic on a date string — not a "now", so it stays in UTC. */
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Who came to the meeting. Four fixed colours in a fixed order, so mother is
 * the same colour on every chart and a quiet day does not repaint the rest.
 */
const WHO_CAME = [
  { key: "mother", label: "Mother", color: SERIES[0] },
  { key: "father", label: "Father", color: SERIES[1] },
  { key: "both", label: "Both parents", color: SERIES[2] },
  { key: "guardian", label: "Guardian", color: SERIES[3] },
];

const ENGAGEMENT_TONE: Record<string, string> = {
  attentive: "ok", neutral: "warn", resistant: "bad",
};

/**
 * What happened at yesterday's parent meetings, what is in the diary today,
 * and what parents keep raising. Yesterday rather than today because a PTM
 * day is written up as it goes: this morning's page would be half empty.
 */
export default async function PtmDashboardPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("ptm");
  const sp = await searchParams;
  const centerId = resolveCenterId(user, sp.center);
  const now = today();
  // any past day can be read, but the page is about yesterday by default
  const day = sp.day && sp.day <= now ? sp.day : addDays(now, -1);
  const days = Number(sp.days) || 30;
  const from = addDays(now, -(days - 1));

  const people = await ptmPeople(centerId);
  // several mentors record meetings; the office reads one at a time. Anyone
  // else who has written one up is kept apart — a teacher is not a mentor.
  const mentors = people.filter((p) => p.role === "mentor");
  const others = people.filter((p) => p.role !== "mentor" && p.recorded > 0);
  const who = people.some((p) => String(p.id) === sp.who) ? Number(sp.who) : null;
  const chosen = people.find((p) => p.id === who);

  const [centers, summary, byCentre, concerns, commitments, perDay, rows, scheduled, scheduledDay,
    coverage, missed, notWrittenUp] =
    await Promise.all([
      centersForUser(user),
      ptmDay(day, centerId, who),
      ptmByCentre(day, centerId, who),
      ptmConcerns(from, now, centerId, who),
      ptmCommitments(from, now, centerId, who),
      ptmPerDay(addDays(now, -13), now, centerId, who),
      ptmInteractionsOn(day, centerId, who),
      ptmScheduled(now, centerId),
      ptmScheduled(day, centerId),
      // who was expected is a question about the centre, not about one mentor,
      // so neither of these narrows to the person chosen above
      ptmDayCoverage(day, centerId),
      ptmAbsentees(day, centerId),
      ptmMissedDays(from, now, centerId),
    ]);

  /** Every link keeps the filters already chosen. */
  const link = (over: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged: Record<string, string | null> = {
      center: sp.center ?? null, days: sp.days ?? null, who: who ? String(who) : null,
      day: day === addDays(now, -1) ? null : day, ...over,
    };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/ptm/dashboard?${q.toString()}`;
  };

  const n = (v: string | undefined) => Number(v ?? 0);
  const held = n(summary?.held);
  const confidence = summary?.confidence == null ? null : Number(summary.confidence);
  /** A count as a share of the day's meetings, for the line under a card. */
  const share = (v: number) => (held ? `${Math.round((v / held) * 100)}%` : "—");
  const engagementParts = [
    { label: "Attentive", value: n(summary?.attentive) },
    { label: "Neutral", value: n(summary?.neutral) },
    { label: "Resistant", value: n(summary?.resistant) },
  ].filter((p) => p.value > 0);

  return (
    <>
      <PageHeader title="PTM dashboard"
        subtitle={chosen
          ? `${chosen.name}${chosen.role === "mentor" ? "" : ` (${ROLE_LABEL[chosen.role as Role]})`}`
            + "'s meetings, and what the parents they saw are raising"
          : "Yesterday's meetings, today's diary, and what parents are raising"}
        right={<Link href="/ptm" className="btn btn-ghost btn-sm">All interactions</Link>} />

      {people.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href={link({ who: null })} scroll={false}
            className={`btn btn-sm ${who === null ? "btn-primary" : "btn-ghost"}`}>
            Everyone
          </Link>
          {mentors.map((p) => (
            <Link key={p.id} href={link({ who: String(p.id) })} scroll={false}
              className={`btn btn-sm ${who === p.id ? "btn-primary" : "btn-ghost"}`}>
              {p.name}
            </Link>
          ))}
          {others.length > 0 && (
            <>
              <span className="text-[12.5px] text-[var(--muted)]">also written up by</span>
              {others.map((p) => (
                <Link key={p.id} href={link({ who: String(p.id) })} scroll={false}
                  className={`btn btn-sm ${who === p.id ? "btn-primary" : "btn-ghost"}`}>
                  {p.name}
                  <span className="ml-1 text-[11px] opacity-70">{ROLE_LABEL[p.role as Role]}</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        extra={[{ name: "days", label: "Last 30 days", options: [
          { value: "7", label: "Concerns: last 7 days" },
          { value: "30", label: "Concerns: last 30 days" },
          { value: "90", label: "Concerns: last 90 days" },
        ] }]}
      />

      {/* ------------------------------------------------- today's diary */}
      <div className="label-cap mb-2.5 mt-5">PTM days in the diary today · {fmtDate(now)}</div>
      <Card pad={false}>
        {scheduled.length === 0 ? (
          <Empty title="No PTM day scheduled for today"
            hint="Meetings can still be recorded — a PTM day only sets the expectation." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Centre</th><th>Class</th><th>Time</th><th>How</th><th>Recorded so far</th><th>Status</th></tr>
              </thead>
              <tbody>
                {scheduled.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium">{m.center_name}
                      <div className="text-[12px] text-[var(--muted)]">{m.title}</div>
                    </td>
                    <td className="text-[var(--muted)]">{m.class_name ?? "All classes"}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {m.start_time ? `${m.start_time}${m.end_time ? ` – ${m.end_time}` : ""}` : "—"}
                    </td>
                    <td className="text-[var(--muted)]">{modeLabel(m.mode)}</td>
                    <td className="tabular-nums">
                      {m.held === 0
                        ? <Badge tone="warn">Nothing recorded yet</Badge>
                        : <>{m.held} of {m.roll}
                            <span className="text-[12px] text-[var(--muted)]"> children</span></>}
                    </td>
                    <td><Badge tone={m.status === "cancelled" ? "bad" : m.status === "completed" ? "ok" : "info"}>
                      {titleCase(m.status)}
                    </Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------- days in the diary nobody wrote up */}
      <div className="label-cap mb-2.5 mt-6 flex flex-wrap items-center gap-2">
        <span>PTM days scheduled but not written up</span>
        <span className="text-[12px] font-normal normal-case text-[var(--muted)]">
          last {days} days
          {notWrittenUp.length > 0 ? ` · ${notWrittenUp.length} to chase` : ""}
        </span>
      </div>
      <Card pad={false}>
        {notWrittenUp.length === 0 ? (
          <Empty title="Every PTM day was written up"
            hint={`No day in the diary over the last ${days} days passed without a meeting recorded against it.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Centre</th><th>Class</th><th>What was planned</th>
                  <th>Children expected</th><th>Marked as</th><th></th>
                </tr>
              </thead>
              <tbody>
                {notWrittenUp.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap">
                      <Link href={link({ day: m.meeting_date })}
                        className="font-medium hover:text-[var(--brand)]">
                        {fmtDate(m.meeting_date)}
                      </Link>
                      <div className="text-[12px] text-[var(--muted)]">
                        {m.days_ago} day{m.days_ago === 1 ? "" : "s"} ago
                      </div>
                    </td>
                    <td className="font-medium">{m.center_name}</td>
                    <td className="text-[var(--muted)]">{m.class_name ?? "All classes"}</td>
                    <td className="text-[var(--muted)]">
                      {m.title}
                      <div className="text-[12px]">
                        {modeLabel(m.mode)}{m.start_time ? ` · ${m.start_time}` : ""}
                      </div>
                    </td>
                    <td className="tabular-nums text-[var(--muted)]">{m.roll}</td>
                    <td>
                      {/* a day the centre closed off as done, with nothing behind
                          it, is worse than one still sitting open */}
                      <Badge tone={m.status === "completed" ? "bad" : "warn"}>
                        {m.status === "completed" ? "Completed, nothing recorded" : "Nothing recorded"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href="/ptm/new" className="btn btn-ghost btn-sm">Record a meeting</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* --------------------------------------------------- yesterday */}
      <div className="label-cap mb-2.5 mt-6 flex flex-wrap items-center gap-2">
        <span>Meetings on {fmtDate(day)}</span>
        <Link href={link({ day: addDays(day, -1) })}
          className="text-[12px] font-normal text-[var(--brand)] hover:underline">
          ← day before
        </Link>
        {day < addDays(now, -1) && (
          <Link href={link({ day: addDays(day, 1) })}
            className="text-[12px] font-normal text-[var(--brand)] hover:underline">
            day after →
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Meetings held" value={held}
          hint={held ? `${n(summary?.centres)} centre${n(summary?.centres) === 1 ? "" : "s"} · ${n(summary?.children)} children` : "none recorded"} />
        {/* who actually turned up, one card each: a centre where only mothers
            ever come is a different problem from one where nobody does */}
        <StatCard label="Both parents came" value={n(summary?.both_parents)}
          hint={held ? `${share(n(summary?.both_parents))} of meetings` : "—"} />
        <StatCard label="Mother came" value={n(summary?.mother)}
          hint={held ? `${share(n(summary?.mother))} of meetings · on her own` : "—"} />
        <StatCard label="Father came" value={n(summary?.father)}
          hint={held ? `${share(n(summary?.father))} of meetings · on his own` : "—"} />
        {n(summary?.guardian) > 0 && (
          <StatCard label="Guardian came" value={n(summary?.guardian)}
            hint={`${share(n(summary?.guardian))} of meetings · neither parent`} />
        )}
        <StatCard label="Parents engaged" value={n(summary?.attentive)}
          hint={`${n(summary?.neutral)} neutral · ${n(summary?.resistant)} resistant`}
          tone={held && n(summary?.resistant) > n(summary?.attentive) ? "warn" : "default"} />
        <StatCard label="Follow-ups promised" value={n(summary?.follow_ups)}
          hint={`${n(summary?.no_follow_up)} needed none`} />
        {/* the mentor's own reading of how the family is going, 1 to 5,
            averaged over the meetings where it was rated */}
        <StatCard label="Confidence in progress"
          value={confidence === null ? "—" : `${confidence.toFixed(1)} of 5`}
          hint={confidence === null
            ? "not rated in any meeting"
            : `across ${n(summary?.rated)} of ${held} meeting${held === 1 ? "" : "s"}`}
          tone={confidence === null ? "default"
            : confidence < 2.5 ? "bad" : confidence < 3.5 ? "warn" : "ok"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame title={`Meetings by centre · ${fmtDate(day)}`}
          subtitle="Meetings held, against the children on each centre's roll"
          empty={byCentre.length === 0}
          table={{ head: ["Centre", "Meetings", "Children seen", "On the roll", "Share of roll",
            "Parents engaged", "Follow-ups", "Confidence"],
            rows: byCentre.map((c) => [c.center_name, c.held, c.children, c.roll,
              c.roll ? `${Math.round((c.children / c.roll) * 100)}%` : "—",
              c.attentive, c.follow_ups,
              c.confidence == null ? "—" : `${Number(c.confidence).toFixed(1)} of 5`]) }}>
          <HBarChart data={byCentre.map((c) => ({
            label: `${c.center_name} · ${c.roll} on roll`,
            value: c.held,
            hint: c.roll ? `${c.children} of ${c.roll} children seen` : undefined,
          }))} color={SERIES[0]} labelWidth={150} />
        </ChartFrame>

        <ChartFrame title="Meetings over the last fortnight"
          subtitle="Each day's meetings, by who came to them"
          series={WHO_CAME}
          empty={perDay.every((d) => d.n === 0)}
          table={{ head: ["Day", "Mother", "Father", "Both parents", "Guardian", "Meetings"],
            rows: perDay.filter((d) => d.n > 0).map((d) =>
              [fmtDate(d.day), d.mother, d.father, d.both, d.guardian, d.n]) }}>
          <StackedBarChart
            data={perDay.map((d) => ({
              label: d.day.slice(8) + "/" + d.day.slice(5, 7),
              parts: { mother: d.mother, father: d.father, both: d.both, guardian: d.guardian },
            }))}
            series={WHO_CAME} />
        </ChartFrame>

        <ChartFrame title="What parents raised"
          subtitle={`Concerns ticked in the last ${days} days · a meeting can raise several`}
          empty={concerns.length === 0}
          table={{ head: ["Concern", "Times raised", "Centres"],
            rows: concerns.map((c) => [c.concern, c.n, c.centres]) }}>
          <HBarChart data={concerns.map((c) => ({ label: c.concern, value: c.n }))} color={SERIES[1]} />
        </ChartFrame>

        <ChartFrame title="What parents promised"
          subtitle={`Commitments made in the last ${days} days`}
          empty={commitments.length === 0}
          table={{ head: ["Commitment", "Times made"],
            rows: commitments.map((c) => [c.commitment, c.n]) }}>
          <HBarChart data={commitments.map((c) => ({ label: c.commitment, value: c.n }))}
            color={SERIES[2]} />
        </ChartFrame>
      </div>

      {engagementParts.length > 0 && (
        <p className="mt-4 text-[13px] text-[var(--muted)]">
          On {fmtDate(day)}: {engagementParts.map((p) => `${p.value} ${p.label.toLowerCase()}`).join(", ")}
          {n(summary?.support) > 0 && ` · ${n(summary?.support)} asked for help from the team`}
          {scheduledDay.length > 0 && ` · ${scheduledDay.length} PTM day${scheduledDay.length === 1 ? " was" : "s were"} in the diary`}
        </p>
      )}

      {/* ------------------------------------------- the meetings themselves */}
      <div className="label-cap mb-2.5 mt-6">Every meeting on {fmtDate(day)}</div>
      <Card pad={false}>
        {rows.length === 0 ? (
          <Empty title="No meetings recorded that day"
            hint="Pick another day above, or open All interactions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th><th>Centre</th><th>Class</th>
                  <th>Who came, and on what number</th>
                  <th>How it went</th><th>Concerns</th><th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/ptm/${r.id}`} className="font-medium hover:underline">{r.student}</Link>
                      <FlagMark status={r.flag_status} urgency={r.flag_urgency} raisedOn={r.flag_on} />
                      <SiblingMark count={r.sibling_count} names={r.sibling_names} />
                      <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                    </td>
                    <td className="text-[var(--muted)]">{r.center_name}</td>
                    <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    <td>
                      <div>{parentLabel(r.parent_present)}</div>
                      <div className="text-[12px] text-[var(--muted)]">
                        {r.parent_name ?? "name not on record"}
                        {r.phone ? <> · <a href={`tel:${r.phone}`}
                          className="hover:text-[var(--brand)]">{r.phone}</a></> : ""}
                      </div>
                    </td>
                    <td><Badge tone={ENGAGEMENT_TONE[r.engagement]}>{engagementLabel(r.engagement)}</Badge></td>
                    <td className="max-w-[260px] text-[12.5px] text-[var(--muted)]">
                      {r.concern_tags.length ? r.concern_tags.join(", ") : "—"}
                    </td>
                    <td className="whitespace-nowrap text-[12.5px]">
                      {r.follow_up_required
                        ? <>{fmtDate(r.follow_up_date)}{r.follow_up_status !== "pending" && ` · ${titleCase(r.follow_up_status)}`}</>
                        : <span className="text-[var(--faint)]">not needed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ------------------------------------- the parents who did not come */}
      <div className="label-cap mb-2.5 mt-6 flex flex-wrap items-center gap-2">
        <span>Parents who did not come on {fmtDate(day)}</span>
        {coverage.expected > 0 && (
          <span className="text-[12px] font-normal normal-case text-[var(--muted)]">
            {coverage.met} of {coverage.expected} families seen
            {coverage.missed > 0 ? ` · ${coverage.missed} to follow up` : ""}
          </span>
        )}
      </div>
      <Card pad={false}>
        {coverage.expected === 0 ? (
          <Empty title="Nobody was expected that day"
            hint="This list fills once a PTM day is in the diary for a centre, or a meeting is recorded there." />
        ) : missed.length === 0 ? (
          <Empty title="Every family expected that day was seen"
            hint={`All ${coverage.expected} of them. Pick another day above to check that one.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th>
                  {!centerId && <th>Centre</th>}
                  <th>Class</th><th>Parents</th><th>Phone</th><th>Last sat down with</th><th></th>
                </tr>
              </thead>
              <tbody>
                {missed.map((r) => (
                  <tr key={r.student_id}>
                    <td>
                      <Link href={`/students/${r.student_id}`}
                        className="font-medium hover:text-[var(--brand)]">{r.student}</Link>
                      <FlagMark status={r.flag_status} urgency={r.flag_urgency} raisedOn={r.flag_on} />
                      <SiblingMark count={r.sibling_count} names={r.sibling_names} />
                      <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                    </td>
                    {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                    <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    <td className="text-[13px] text-[var(--muted)]">
                      {[r.father_name, r.mother_name, r.guardian_name].filter(Boolean).join(" · ")
                        || <span className="text-[var(--faint)]">not on record</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.phone
                        ? <a href={`tel:${r.phone}`} className="hover:text-[var(--brand)]">{r.phone}</a>
                        : <span className="text-[13px] text-[var(--faint)]">no number</span>}
                    </td>
                    <td className="whitespace-nowrap text-[13px]">
                      {r.last_met
                        ? <>{fmtDate(r.last_met)}
                            <span className="text-[12px] text-[var(--muted)]">
                              {" "}· {r.met_this_session} this session
                            </span></>
                        : <Badge tone="warn">Never met</Badge>}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link href={`/ptm/new?student=${r.student_id}`} className="btn btn-ghost btn-sm">
                        Record a meeting
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Number(missed[0]?.total_rows ?? 0) > missed.length && (
              <p className="px-5 py-3 text-[13px] text-[var(--muted)]">
                Showing the {missed.length} families longest unseen, of{" "}
                {Number(missed[0].total_rows)}. The full list, for any period, is in{" "}
                <Link href="/reports?report=ptm-attendance"
                  className="text-[var(--brand)] hover:underline">Reports</Link>.
              </p>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
