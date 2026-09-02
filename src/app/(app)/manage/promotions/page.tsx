import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { listCenters, listSessions } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import PromoteForm from "./PromoteForm";

export default async function PromotionsPage() {
  await requireRole("super_admin");
  const [sessions, centers] = await Promise.all([listSessions(), listCenters()]);
  const current = sessions.find((s) => s.is_current) ?? null;
  const next = current ? sessions.find((s) => s.sequence === current.sequence + 1) ?? null : null;

  // The same rule the run itself applies: a child's total against the total of
  // the pass marks on the papers they sat.
  const preview = current
    ? await query<{
        class_name: string; total: string; passed: string; failed: string;
        no_marks: string; retain: string; hold: string; terminal: boolean;
      }>(
        `WITH res AS (
           SELECT m.student_id,
                  count(*) AS papers,
                  sum(CASE WHEN m.is_absent THEN 0
                           ELSE COALESCE(m.marks_obtained, 0) END) AS obtained,
                  sum(COALESCE(x.pass_marks, x.max_marks / 3.0)) AS pass_mark
             FROM exam_marks m
             JOIN exams x ON x.id = m.exam_id
            WHERE x.session_id = $1 AND (m.marks_obtained IS NOT NULL OR m.is_absent)
            GROUP BY m.student_id
         )
         SELECT cl.name AS class_name, cl.is_terminal AS terminal,
                count(*) AS total,
                count(*) FILTER (WHERE e.promotion_decision = 'promote'
                                   AND r.papers IS NOT NULL
                                   AND r.obtained >= r.pass_mark) AS passed,
                count(*) FILTER (WHERE e.promotion_decision = 'promote'
                                   AND r.papers IS NOT NULL
                                   AND r.obtained < r.pass_mark) AS failed,
                count(*) FILTER (WHERE e.promotion_decision = 'promote'
                                   AND r.papers IS NULL) AS no_marks,
                count(*) FILTER (WHERE e.promotion_decision = 'retain') AS retain,
                count(*) FILTER (WHERE e.promotion_decision = 'hold') AS hold
           FROM enrollments e
           JOIN class_levels cl ON cl.id = e.class_level_id
           JOIN students s ON s.id = e.student_id
           LEFT JOIN res r ON r.student_id = e.student_id
          WHERE e.session_id = $1 AND e.status = 'active' AND s.status = 'active'
          GROUP BY cl.name, cl.sequence, cl.is_terminal
          ORDER BY cl.sequence`,
        [current.id],
      )
    : [];

  const runs = await query<{
    id: number; from_name: string; to_name: string; center_name: string | null;
    promoted_count: number; retained_count: number; graduated_count: number;
    skipped_count: number; run_at: string; run_by_name: string | null;
  }>(
    `SELECT r.id, f.name AS from_name, t.name AS to_name, c.name AS center_name,
            r.promoted_count, r.retained_count, r.graduated_count, r.skipped_count,
            r.run_at, u.name AS run_by_name
       FROM promotion_runs r
       JOIN academic_sessions f ON f.id = r.from_session_id
       JOIN academic_sessions t ON t.id = r.to_session_id
       LEFT JOIN centers c ON c.id = r.center_id
       LEFT JOIN users u ON u.id = r.run_by
      ORDER BY r.run_at DESC LIMIT 20`,
  );

  return (
    <>
      <PageHeader title="Promotions"
        subtitle="Move every student up a class when a new session begins" />

      {!next && (
        <div className="mb-5">
          <Alert kind="warn">
            There is no session after {current?.name ?? "the current one"}. Create the next
            session first on the Sessions page.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card pad={false}>
            <h2 className="px-5 pt-5 text-[15px] font-semibold">
              What will happen {current ? `to ${current.name}` : ""}
            </h2>
            <p className="px-5 pb-3 pt-1 text-[13px] text-[var(--muted)]">
              The result decides. A child whose total reached the total of the pass
              marks on the papers they sat moves up; one who fell short repeats the
              class. A child with no marks on record moves up — there is nothing to
              hold them back on. Retain and hold set by hand on a student&rsquo;s page
              override all of it.
            </p>
            {preview.length === 0 ? (
              <Empty title="No active enrolments" hint="Nothing to promote yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Class</th><th>Students</th><th>Passed</th><th>Fell short</th>
                      <th>No marks</th><th>Retain set</th><th>Hold</th><th>Outcome</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.class_name}>
                        <td className="font-medium">{r.class_name}</td>
                        <td className="tabular-nums">{r.total}</td>
                        <td className="tabular-nums text-[var(--ok)]">{r.passed}</td>
                        <td className="tabular-nums text-[var(--warn)]">{r.failed}</td>
                        <td className="tabular-nums text-[var(--muted)]">{r.no_marks}</td>
                        <td className="tabular-nums">{r.retain}</td>
                        <td className="tabular-nums">{r.hold}</td>
                        <td className="text-[13px] text-[var(--muted)]">
                          {r.terminal ? "Graduates out of the programme" : "Moves to the next class"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pb-3 pt-5 text-[15px] font-semibold">Past runs</h2>
            {runs.length === 0 ? (
              <Empty title="No promotions have been run yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>When</th><th>Sessions</th><th>Centre</th>
                      <th>Promoted</th><th>Retained</th><th>Graduated</th><th>Skipped</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDateTime(r.run_at)}</td>
                        <td>{r.from_name} → {r.to_name}</td>
                        <td className="text-[var(--muted)]">{r.center_name ?? "All centres"}</td>
                        <td className="tabular-nums">{r.promoted_count}</td>
                        <td className="tabular-nums">{r.retained_count}</td>
                        <td className="tabular-nums">{r.graduated_count}</td>
                        <td className="tabular-nums">{r.skipped_count}</td>
                        <td className="text-[var(--muted)]">{r.run_by_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <PromoteForm sessions={sessions} centers={centers}
          defaultFrom={current?.id ?? null} defaultTo={next?.id ?? null} />
      </div>
    </>
  );
}
