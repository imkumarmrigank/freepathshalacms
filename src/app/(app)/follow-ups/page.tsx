import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, resolveCenterId } from "@/lib/queries";
import { Avatar, Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import AssignFollowUp from "./AssignFollowUp";
import { fmtDate, fullName, titleCase, today } from "@/lib/format";
import { isGlobalRole } from "@/lib/roles";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { one } from "@/lib/db";

export default async function FollowUpsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, session] = await Promise.all([centersForUser(user), currentSession()]);
  const centerId = resolveCenterId(user, sp.center);
  const status = sp.status ?? "pending";

  const params: unknown[] = [session?.id ?? 0, status];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND i.center_id = $${params.length}`; }

  // the three headline numbers count the whole filtered set, not the page
  const tally = await one<{ overdue: string; due_soon: string; open_total: string }>(
    `SELECT count(*) FILTER (WHERE i.follow_up_date < CURRENT_DATE) AS overdue,
            count(*) FILTER (WHERE i.follow_up_date BETWEEN CURRENT_DATE
                                   AND CURRENT_DATE + 7) AS due_soon,
            count(*) AS open_total
       FROM ptm_interactions i
      WHERE i.follow_up_required AND i.session_id = $1 AND i.follow_up_status = $2 ${where}`,
    params,
  );

  const pg = pageFrom(sp);
  params.push(pg.size, pg.offset);

  const rows = await query<{
    id: number; first_name: string; last_name: string | null; enrollment_no: string;
    follow_up_date: string | null; follow_up_mode: string | null; follow_up_status: string;
    interaction_date: string; mentor: string | null; concerns: string | null;
    class_name: string | null; center_name: string;
    center_id: number; assignee_id: number | null; assignee: string | null;
    total_rows: string;
  }>(
    `SELECT count(*) OVER () AS total_rows,
            i.id, s.first_name, s.last_name, s.enrollment_no, i.follow_up_date,
            i.follow_up_mode, i.follow_up_status, i.interaction_date, u.name AS mentor,
            i.concerns, cl.name AS class_name, ce.name AS center_name,
            i.center_id, i.follow_up_assignee_id AS assignee_id, asg.name AS assignee
       FROM ptm_interactions i
       LEFT JOIN users asg ON asg.id = i.follow_up_assignee_id
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
      WHERE i.follow_up_required AND i.session_id = $1 AND i.follow_up_status = $2 ${where}
      ORDER BY i.follow_up_date NULLS LAST, i.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = totalOf(rows, Number(tally?.open_total ?? 0));
  const win = pageWindow(pg, rows.length, total);
  const overdue = Number(tally?.overdue ?? 0);
  const dueSoon = Number(tally?.due_soon ?? 0);

  // anyone who can actually carry out a follow-up
  const people = await query<{ id: number; name: string }>(
    `SELECT u.id, u.name FROM users u
      WHERE u.is_active AND u.role IN ('teacher','backup_teacher','center_manager')
        ${centerId ? "AND (u.center_id = $1 OR u.role = 'backup_teacher')" : ""}
      ORDER BY u.name`,
    centerId ? [centerId] : [],
  );
  const canAssign = user.role !== "teacher" && user.role !== "backup_teacher";

  return (
    <>
      <PageHeader title="Follow-ups"
        subtitle="Commitments made to parents during a PTM" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Overdue" value={overdue} hint="past the promised date"
          tone={overdue ? "bad" : "default"} />
        <StatCard label="Due this week" value={dueSoon} hint="next 7 days"
          tone={dueSoon ? "warn" : "default"} />
        <StatCard label="Open in total" value={total} hint="still pending" />
      </div>

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        extra={[{ name: "status", label: "Pending",
          options: [
            { value: "pending", label: "Pending" },
            { value: "done", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ] }]}
      />

      <Card className="mt-4 overflow-hidden" pad={false}>
        {rows.length === 0 ? (
          <Empty title={status === "pending" ? "Nothing pending" : "Nothing here"}
            hint="Follow-ups flagged while recording a parent interaction show up on this page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Due</th><th>Student</th><th>Class</th><th>How</th>
                  <th>Assigned to</th><th>From PTM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const late = r.follow_up_date && r.follow_up_date.slice(0, 10) < today()
                    && r.follow_up_status === "pending";
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">
                        <Link href={`/ptm/${r.id}`}
                          className={`font-medium ${late ? "text-[var(--bad)]" : ""} hover:underline`}>
                          {fmtDate(r.follow_up_date)}
                        </Link>
                        {late && <div><Badge tone="bad">Overdue</Badge></div>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={fullName(r)} size={30} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{fullName(r)}</div>
                            <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                      <td className="text-[var(--muted)]">{titleCase(r.follow_up_mode ?? "—")}</td>
                      <td>
                        {canAssign && r.follow_up_status === "pending" ? (
                          <AssignFollowUp id={r.id} assigneeId={r.assignee_id}
                            people={people} />
                        ) : (
                          <span className="text-[13px] text-[var(--muted)]">
                            {r.assignee ?? r.mentor ?? "—"}
                          </span>
                        )}
                      </td>
                      <td className="text-[var(--muted)]">{fmtDate(r.interaction_date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="follow-up" />
      </Card>
    </>
  );
}
