import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import ResultRows, { type Row as ResultRow } from "./ResultRows";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole, ROLE_LABEL, type Role } from "@/lib/roles";
import { TESTED_ROLES } from "@/lib/staff-test-meta";

export const metadata = { title: "Test results · Pehchaan" };

type Row = ResultRow & { total_rows: string };

/** Every paper anyone has taken — the office's view of the same tests. */
export default async function TestResultsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, sp.center);

  const params: unknown[] = [];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND t.center_id = $${params.length}`; }
  if ((TESTED_ROLES as readonly string[]).includes(sp.role ?? "")) {
    params.push(sp.role); where += ` AND t.for_role = $${params.length}`;
  }
  if (sp.status) { params.push(sp.status); where += ` AND t.status = $${params.length}`; }
  if (sp.month) { params.push(`${sp.month}-01`); where += ` AND t.cycle_month = $${params.length}`; }

  const pg = pageFrom(sp, 25);
  const listParams = [...params, pg.size, pg.offset];

  const [rows, months, tally] = await Promise.all([
    query<Row>(
      `SELECT count(*) OVER () AS total_rows,
              t.id, u.name, u.role, c.name AS center_name,
              to_char(t.cycle_month, 'YYYY-MM-DD') AS cycle_month, t.slot,
              COALESCE(cfg.tests_per_month, 4) AS tests_per_month,
              t.started_at, t.submitted_at, t.status, t.score, t.total,
              t.duration_minutes,
              (SELECT count(*) FROM staff_test_answers a
                WHERE a.test_id = t.id AND a.chosen_index IS NOT NULL)::int AS answered,
              CASE WHEN t.submitted_at IS NOT NULL
                   THEN round(extract(epoch FROM t.submitted_at - t.started_at) / 60)
              END::int AS minutes
         FROM staff_tests t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN centers c ON c.id = t.center_id
         LEFT JOIN staff_test_config cfg ON cfg.for_role = t.for_role
        WHERE 1=1 ${where}
        ORDER BY t.started_at DESC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams),
    query<{ month: string }>(
      `SELECT DISTINCT to_char(cycle_month, 'YYYY-MM') AS month
         FROM staff_tests ORDER BY month DESC LIMIT 24`),
    query<{ taken: string; submitted: string; expired: string; avg_pct: string | null }>(
      `SELECT count(*) AS taken,
              count(*) FILTER (WHERE t.status = 'submitted')          AS submitted,
              count(*) FILTER (WHERE t.status = 'expired')            AS expired,
              round(avg(100.0 * t.score / NULLIF(t.total, 0))
                    FILTER (WHERE t.status <> 'in_progress'))         AS avg_pct
         FROM staff_tests t WHERE 1=1 ${where}`, params),
  ]);

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);
  const sum = tally[0];

  return (
    <>
      <PageHeader title="Test results"
        subtitle="Every paper taken, and what happened to the ones that ran out of time"
        right={<Link href="/manage/tests" className="btn">Question bank</Link>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Papers taken" value={total} hint="matching these filters" />
        <StatCard label="Handed in" value={Number(sum?.submitted ?? 0)} tone="ok" />
        <StatCard label="Ran out of time" value={Number(sum?.expired ?? 0)}
          tone={Number(sum?.expired ?? 0) > 0 ? "warn" : "default"} />
        <StatCard label="Average score"
          value={sum?.avg_pct == null ? "—" : `${Number(sum.avg_pct)}%`}
          tone={sum?.avg_pct == null ? "default"
            : Number(sum.avg_pct) >= 60 ? "ok" : "warn"} />
      </div>

      <div className="mt-4">
        <Filters
          centers={isGlobalRole(user.role) ? centers : []}
          current={sp}
          extra={[
            { name: "role", label: "Any role",
              options: TESTED_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r as Role] ?? r })) },
            { name: "status", label: "Any outcome", options: [
              { value: "submitted", label: "Handed in" },
              { value: "expired", label: "Ran out of time" },
              { value: "in_progress", label: "Still open" },
            ] },
            { name: "month", label: "Any month",
              options: months.map((m) => ({
                value: m.month,
                label: new Date(`${m.month}-01`).toLocaleDateString("en-IN",
                  { month: "long", year: "numeric" }) })) },
          ]}
        />
      </div>

      <Card className="mt-4" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No tests taken yet"
            hint="Once staff start taking the monthly test, every paper appears here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Who</th><th>Centre</th><th>Month</th><th>Test</th>
                  <th>Score</th><th>Answered</th><th>Time taken</th><th>Outcome</th>
                </tr>
              </thead>
              <ResultRows rows={rows} />
            </table>
          </div>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="paper" />
      </Card>
    </>
  );
}
