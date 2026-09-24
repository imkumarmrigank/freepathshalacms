import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import {
  currentCycle, slotsTaken, testConfig, testsOf, bankSize,
} from "@/lib/staff-tests";
import {
  TESTED_ROLES, TEST_STATUS_LABEL, TEST_STATUS_TONE, pct, slotLabel,
} from "@/lib/staff-test-meta";
import StartTest from "./StartTest";

export const metadata = { title: "My test · Pehchaan" };

/**
 * The staff member's own test page: the month's four slots, whichever one is
 * open now, and everything they have taken before.
 */
export default async function MyTestPage() {
  const user = await requireUser();
  if (!(TESTED_ROLES as readonly string[]).includes(user.role)) {
    return (
      <>
        <PageHeader title="My test" subtitle="Monthly test for staff" />
        <Card>
          <Empty title="There is no test for your role yet"
            hint="Tests are being written role by role. Teachers are first." />
        </Card>
      </>
    );
  }

  const cfg = await testConfig(user.role);
  const { cycle, slot } = currentCycle(cfg);
  const [taken, history, bank] = await Promise.all([
    slotsTaken(user.uid, cycle), testsOf(user.uid), bankSize(user.role),
  ]);

  const bySlot = new Map(taken.map((t) => [t.slot, t]));
  const current = bySlot.get(slot);
  const done = history.filter((t) => t.status !== "in_progress");
  const best = done.reduce((m, t) => Math.max(m, pct(t.score ?? 0, t.total)), 0);
  const average = done.length
    ? Math.round(done.reduce((n, t) => n + pct(t.score ?? 0, t.total), 0) / done.length)
    : null;

  return (
    <>
      <PageHeader title="My test"
        subtitle={`${cfg.question_count} questions · ${cfg.duration_minutes} minutes · `
          + `${cfg.tests_per_month} tests a month`} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tests taken" value={done.length} hint="all time" />
        <StatCard label="Average score" value={average === null ? "—" : `${average}%`}
          tone={average === null ? "default" : average >= 60 ? "ok" : "warn"} />
        <StatCard label="Best score" value={done.length ? `${best}%` : "—"} />
      </div>

      <div className="label-cap mb-2.5 mt-6">This month</div>
      <Card>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: cfg.tests_per_month }, (_, i) => i + 1).map((n) => {
            const t = bySlot.get(n);
            const state = t ? t.status : n === slot ? "open" : n < slot ? "missed" : "later";
            return (
              <div key={n}
                className={`min-w-[150px] flex-1 rounded-[10px] border px-4 py-3 ${
                  n === slot ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
                <div className="text-[13px] font-medium">{slotLabel(n, cfg.tests_per_month)}</div>
                <div className="mt-1.5 text-[13px] text-[var(--muted)]">
                  {t
                    ? t.status === "in_progress"
                      ? <Badge tone="info">Still open</Badge>
                      : <>{t.score ?? 0} of {t.total} · {pct(t.score ?? 0, t.total)}%</>
                    : state === "open" ? "Ready to take"
                    : state === "missed" ? <span className="text-[var(--faint)]">Not taken</span>
                    : <span className="text-[var(--faint)]">Later this month</span>}
                </div>
                {t?.status === "in_progress" && (
                  <Link href={`/my-test/${t.id}`}
                    className="mt-2 inline-block text-[13px] text-[var(--brand)] hover:underline">
                    Continue
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          {!cfg.is_open ? (
            <p className="text-[13px] text-[var(--muted)]">
              The test is closed at the moment. Your administrator will open it.
            </p>
          ) : (bank?.active ?? 0) === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              No questions have been added yet. Ask your administrator.
            </p>
          ) : current ? (
            <p className="text-[13px] text-[var(--muted)]">
              {current.status === "in_progress"
                ? "This month's test is open — continue where you left off."
                : "You have taken this test. The next one opens in the next stretch of the month."}
            </p>
          ) : (
            <StartTest role={user.role}
              label={`Start ${slotLabel(slot, cfg.tests_per_month).toLowerCase()}`}
              note={`${cfg.question_count} questions · ${cfg.duration_minutes} minutes · once started, the clock does not stop`} />
          )}
        </div>
      </Card>

      <div className="label-cap mb-2.5 mt-6">Everything you have taken</div>
      <Card pad={false}>
        {history.length === 0 ? (
          <Empty title="No tests yet" hint="Your first test is above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Month</th><th>Test</th><th>Taken on</th><th>Score</th><th>Status</th></tr>
              </thead>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">
                      {new Date(t.cycle_month).toLocaleDateString("en-IN",
                        { month: "long", year: "numeric" })}
                    </td>
                    <td className="text-[var(--muted)]">{slotLabel(t.slot, cfg.tests_per_month)}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">{fmtDate(t.started_at)}</td>
                    <td className="tabular-nums">
                      {t.status === "in_progress"
                        ? <span className="text-[13px] text-[var(--faint)]">—</span>
                        : <>{t.score ?? 0} of {t.total}
                            <span className="ml-1 text-[12px] text-[var(--muted)]">
                              {pct(t.score ?? 0, t.total)}%
                            </span></>}
                    </td>
                    <td>
                      <Badge tone={TEST_STATUS_TONE[t.status]}>
                        {TEST_STATUS_LABEL[t.status] ?? t.status}
                      </Badge>
                      {t.status === "in_progress" && (
                        <Link href={`/my-test/${t.id}`}
                          className="ml-2 text-[13px] text-[var(--brand)] hover:underline">
                          Continue
                        </Link>
                      )}
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
