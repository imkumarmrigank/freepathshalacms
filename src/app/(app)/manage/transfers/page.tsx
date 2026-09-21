import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { currentSession, listClasses } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import TransferForm, { type Pupil } from "./TransferForm";

export const metadata = { title: "Transfer students · Pehchaan" };

export default async function TransfersPage({
  searchParams,
}: { searchParams: Promise<{ student?: string }> }) {
  await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const session = await currentSession();
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const [pupils, centres, classes, recent] = await Promise.all([
    query<Pupil>(
      `SELECT s.id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name,
              s.enrollment_no, s.center_id, c.name AS center_name,
              e.class_level_id AS class_id, cl.name AS class_name, s.father_name
         FROM students s
         JOIN centers c ON c.id = s.center_id
         LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
         LEFT JOIN class_levels cl ON cl.id = e.class_level_id
        WHERE s.status = 'active'
        ORDER BY name`,
      [session.id]),
    query<{ id: number; code: string; name: string }>(
      "SELECT id, code, name FROM centers WHERE is_active ORDER BY code"),
    listClasses(),
    query<{
      id: number; student_id: number; student: string; enrollment_no: string;
      from_centre: string; to_centre: string; from_class: string | null; to_class: string | null;
      transferred_on: string; reason: string | null; by_name: string | null;
      moved_history: boolean; moved_attendance: number; moved_ptm: number;
    }>(
      `SELECT t.id, s.id AS student_id,
              trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
              s.enrollment_no, fc.name AS from_centre, tc.name AS to_centre,
              fcl.name AS from_class, tcl.name AS to_class, t.transferred_on, t.reason,
              u.name AS by_name, t.moved_history, t.moved_attendance, t.moved_ptm
         FROM student_transfers t
         JOIN students s ON s.id = t.student_id
         JOIN centers fc ON fc.id = t.from_center_id
         JOIN centers tc ON tc.id = t.to_center_id
         LEFT JOIN class_levels fcl ON fcl.id = t.from_class_id
         LEFT JOIN class_levels tcl ON tcl.id = t.to_class_id
         LEFT JOIN users u ON u.id = t.transferred_by
        ORDER BY t.created_at DESC LIMIT 30`),
  ]);

  return (
    <>
      <PageHeader title="Transfer students"
        subtitle="Move a child to another centre — their records go with them" />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <TransferForm pupils={pupils} centres={centres}
            classes={classes.map((c) => ({ id: c.id, name: c.name }))}
            preselect={Number(sp.student) || null} />
        </div>

        <div className="lg:col-span-3">
          <div className="label-cap mb-2.5">Recent transfers</div>
          <Card pad={false}>
            {recent.length === 0 ? (
              <Empty title="No transfers yet" hint="Every transfer is listed here, with who made it." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Student</th><th>From → To</th><th>Class</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDate(r.transferred_on)}</td>
                        <td>
                          <Link href={`/students/${r.student_id}`} className="font-medium hover:underline">
                            {r.student}
                          </Link>
                          <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                        </td>
                        <td>
                          {r.from_centre} → <strong>{r.to_centre}</strong>
                          {r.reason && <div className="text-[12px] text-[var(--muted)]">{r.reason}</div>}
                        </td>
                        <td className="text-[var(--muted)]">
                          {r.from_class === r.to_class ? (r.to_class ?? "—") : `${r.from_class ?? "—"} → ${r.to_class ?? "—"}`}
                        </td>
                        <td className="text-[var(--muted)]">{r.by_name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
