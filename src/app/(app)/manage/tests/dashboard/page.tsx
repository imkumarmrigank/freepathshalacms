import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { BarChart, ChartFrame, HBarChart, StackedBarChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-palette";
import { fmtDate } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { TESTED_ROLES } from "@/lib/staff-test-meta";
import { bankSize, currentCycle, testConfig } from "@/lib/staff-tests";
import {
  byCentre, byTopic, hardestQuestions, notTakenYet, scoreSpread, scoresByMonth,
  standings, testHeadline,
} from "@/lib/staff-test-dashboard";

export const metadata = { title: "Staff training · Pehchaan" };

const TAKEN = [
  { key: "took", label: "Took the test", color: SERIES[0] },
  { key: "missing", label: "Has not yet", color: SERIES[3] },
];

const MONTHS = [
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
];

/** A question, short enough to sit down the side of a chart. */
function short(s: string, n = 58) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * What the training is doing: who has taken this month's test, how the scores
 * are moving, and — the part worth acting on — which questions and topics the
 * staff keep getting wrong.
 */
export default async function TrainingDashboardPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const role = (TESTED_ROLES as readonly string[]).includes(sp.role ?? "")
    ? (sp.role as string) : "teacher";
  const months = MONTHS.some((m) => m.value === sp.months) ? Number(sp.months) : 6;

  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, sp.center);
  const cfg = await testConfig(role);
  const { cycle, slot } = currentCycle(cfg);

  const [head, perMonth, centresRows, hardest, topics, spread, notTaken, top, bank] =
    await Promise.all([
      testHeadline(role, centerId, months),
      scoresByMonth(role, centerId, months),
      byCentre(role, cycle, centerId),
      hardestQuestions(role, centerId),
      byTopic(role, centerId),
      scoreSpread(role, centerId, months),
      notTakenYet(role, cycle, centerId),
      standings(role, centerId, months),
      bankSize(role),
    ]);

  const staff = centresRows.reduce((n, c) => n + c.staff, 0);
  const took = centresRows.reduce((n, c) => n + c.took, 0);
  const monthName = new Date(cycle).toLocaleDateString("en-IN",
    { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Staff training"
        subtitle={`${ROLE_LABEL[role as Role] ?? role} · ${monthName} · test ${slot} of ${cfg.tests_per_month}`}
        right={
          <>
            <Link href="/manage/tests" className="btn btn-ghost btn-sm">Question bank</Link>
            <Link href="/manage/tests/results" className="btn btn-ghost btn-sm">All results</Link>
          </>
        } />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        extra={[
          { name: "role", label: "Teacher's test",
            options: TESTED_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r as Role] ?? r })) },
          { name: "months", label: "Last 6 months", options: MONTHS },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Took this month's test`} value={`${took} of ${staff}`}
          hint={staff ? `${Math.round((took / staff) * 100)}% of the staff on the roll` : "nobody on the roll"}
          tone={staff && took === staff ? "ok" : took ? "warn" : "bad"} />
        <StatCard label="Average score" value={head?.avg_pct == null ? "—" : `${head.avg_pct}%`}
          hint={`over ${head?.papers ?? 0} paper${head?.papers === 1 ? "" : "s"}`}
          tone={head?.avg_pct == null ? "default" : head.avg_pct >= 60 ? "ok" : "warn"} />
        <StatCard label="Half marks or better"
          value={head?.pass_pct == null ? "—" : `${head.pass_pct}%`}
          hint="of the papers handed in"
          tone={head?.pass_pct == null ? "default" : head.pass_pct >= 70 ? "ok" : "warn"} />
        <StatCard label="Beaten by the clock" value={head?.expired ?? 0}
          hint={`${head?.unanswered ?? 0} questions left blank`}
          tone={(head?.expired ?? 0) > 0 ? "warn" : "default"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame title="Scores month by month"
          subtitle={`Average score of every paper handed in · last ${months} months`}
          empty={perMonth.length === 0}
          table={{ head: ["Month", "Papers", "Average", "Ran out of time"],
            rows: perMonth.map((m) => [m.month, m.papers,
              m.avg_pct == null ? "—" : `${m.avg_pct}%`, m.expired]) }}>
          <BarChart color={SERIES[0]} suffix="%"
            data={perMonth.map((m) => ({
              label: new Date(`${m.month}-01`).toLocaleDateString("en-IN", { month: "short" }),
              value: m.avg_pct ?? 0,
              hint: `${m.papers} paper${m.papers === 1 ? "" : "s"}`,
            }))} />
        </ChartFrame>

        <ChartFrame title={`Who has taken ${monthName}'s test`}
          subtitle="Centre by centre, against the staff on that centre's roll"
          series={TAKEN}
          empty={centresRows.length === 0}
          table={{ head: ["Centre", "On the roll", "Took it", "Average"],
            rows: centresRows.map((c) => [c.center_name, c.staff, c.took,
              c.avg_pct == null ? "—" : `${c.avg_pct}%`]) }}>
          <StackedBarChart series={TAKEN}
            data={centresRows.map((c) => ({
              label: c.center_name.length > 9 ? `${c.center_name.slice(0, 8)}…` : c.center_name,
              parts: { took: c.took, missing: Math.max(0, c.staff - c.took) },
            }))} />
        </ChartFrame>

        <ChartFrame title="Where the marks are lost"
          subtitle="Share answered correctly, topic by topic — the weakest first"
          empty={topics.length === 0}
          table={{ head: ["Topic", "Asked", "Right", "Share right"],
            rows: topics.map((t) => [t.topic, t.asked, t.right, `${t.right_pct}%`]) }}>
          <HBarChart color={SERIES[2]} suffix="%" labelWidth={170}
            data={topics.map((t) => ({
              label: short(t.topic, 30), value: t.right_pct,
              hint: `${t.right} right of ${t.asked} answered`,
            }))} />
        </ChartFrame>

        <ChartFrame title="How the scores fall"
          subtitle={`Every paper handed in over the last ${months} months`}
          empty={spread.every((b) => b.papers === 0)}
          table={{ head: ["Band", "Papers"], rows: spread.map((b) => [b.band, b.papers]) }}>
          <BarChart color={SERIES[1]}
            data={spread.map((b) => ({ label: b.band, value: b.papers }))} />
        </ChartFrame>
      </div>

      {/* --------------------------------------------- what to teach next */}
      <div className="label-cap mb-2.5 mt-6">The questions most often got wrong</div>
      <Card pad={hardest.length === 0}>
        {hardest.length === 0 ? (
          <Empty title="Not enough answers yet"
            hint="A question appears here once it has been asked of three people." />
        ) : (
          <div className="px-5 py-4">
            <HBarChart color={SERIES[4] ?? SERIES[1]} suffix="%" labelWidth={300}
              data={hardest.map((q) => ({
                label: short(q.question_en),
                value: q.wrong_pct,
                hint: `${q.wrong} wrong of ${q.asked}${q.topic ? ` · ${q.topic}` : ""}`,
              }))} />
            <ul className="mt-4 space-y-2 border-t border-[#f1f1f6] pt-3">
              {hardest.slice(0, 3).map((q) => (
                <li key={q.id} className="text-[13px]">
                  <span className="font-medium">{q.wrong_pct}% wrong</span>
                  <span className="text-[var(--muted)]"> · {q.question_hi}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------- the chase list */}
        <div>
          <div className="label-cap mb-2.5">Has not taken {monthName}&apos;s test</div>
          <Card pad={false}>
            {notTaken.length === 0 ? (
              <Empty title="Everybody has taken it"
                hint="Every member of staff on the roll has a paper this month." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Who</th><th>Centre</th><th>Last test</th><th>Average so far</th></tr>
                  </thead>
                  <tbody>
                    {notTaken.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-[var(--muted)]">{p.center_name ?? "—"}</td>
                        <td className="whitespace-nowrap text-[var(--muted)]">
                          {p.last_taken
                            ? fmtDate(p.last_taken)
                            : <Badge tone="warn">Never taken one</Badge>}
                        </td>
                        <td className="tabular-nums text-[var(--muted)]">
                          {p.avg_pct == null ? "—" : `${p.avg_pct}% · ${p.papers} paper${p.papers === 1 ? "" : "s"}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* -------------------------------------------------- the standings */}
        <div>
          <div className="label-cap mb-2.5">Best scores · last {months} months</div>
          <Card pad={false}>
            {top.length === 0 ? (
              <Empty title="No papers yet" hint="Scores appear once the first tests are taken." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Who</th><th>Centre</th><th>Papers</th><th>Average</th><th>Best</th></tr>
                  </thead>
                  <tbody>
                    {top.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-[var(--muted)]">{p.center_name ?? "—"}</td>
                        <td className="tabular-nums">{p.papers}
                          {p.expired > 0 && (
                            <span className="ml-1 text-[12px] text-[var(--warn)]">
                              · {p.expired} timed out
                            </span>
                          )}
                        </td>
                        <td className="tabular-nums">{p.avg_pct}%</td>
                        <td className="tabular-nums text-[var(--muted)]">{p.best_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="mt-5 text-[13px] text-[var(--muted)]">
        The bank holds {bank?.active ?? 0} question{bank?.active === 1 ? "" : "s"} in use for this
        role; a paper asks {cfg.question_count} and holds back whatever was asked in the last{" "}
        {cfg.avoid_last_tests} test{cfg.avoid_last_tests === 1 ? "" : "s"}.{" "}
        <Link href="/manage/tests" className="text-[var(--brand)] hover:underline">
          Add or edit questions
        </Link>.
      </p>
    </>
  );
}
