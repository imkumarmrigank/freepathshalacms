import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, listSessions, resolveCenterId } from "@/lib/queries";
import { Avatar, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate, fullName } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  active: "ok", inactive: "mute", graduated: "info", transferred: "mute", dropped: "bad",
};

type Row = {
  id: number; enrollment_no: string; first_name: string; last_name: string | null;
  status: string; class_name: string | null; center_name: string; section: string | null;
  admission_date: string; attendance_pct: string | null; enrolled_here: boolean;
};

export default async function StudentsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, classes, sessions, cur] = await Promise.all([
    centersForUser(user), listClasses(), listSessions(), currentSession(),
  ]);

  const sessionId = Number(sp.session) || cur?.id;
  const centerId = resolveCenterId(user, sp.center);
  const classId = Number(sp.class) || null;
  const q = (sp.q ?? "").trim();

  const params: unknown[] = [sessionId ?? 0];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND s.center_id = $${params.length}`; }
  if (classId) { params.push(classId); where += ` AND e.class_level_id = $${params.length}`; }
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length}
                    OR s.enrollment_no ILIKE $${params.length} OR s.primary_phone ILIKE $${params.length})`;
  }
  if (sp.status) { params.push(sp.status); where += ` AND s.status = $${params.length}`; }

  const rows = await query<Row>(
    `SELECT s.id, s.enrollment_no, s.first_name, s.last_name, s.status, s.admission_date,
            cl.name AS class_name, ce.name AS center_name, e.section,
            (e.id IS NOT NULL) AS enrolled_here,
            (SELECT round(100.0 * count(*) FILTER (WHERE a.status IN ('present','late','half_day'))
                    / NULLIF(count(*), 0), 0)
               FROM student_attendance a
              WHERE a.student_id = s.id AND a.session_id = $1) AS attendance_pct
       FROM students s
       JOIN centers ce ON ce.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE 1=1 ${where}
      ORDER BY cl.sequence NULLS LAST, s.first_name
      LIMIT 400`,
    params,
  );

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${rows.length} student${rows.length === 1 ? "" : "s"}${
          cur && sessionId === cur.id ? ` in ${cur.name}` : ""}`}
        right={user.role !== "teacher"
          ? <Link href="/students/new" className="btn btn-primary">+ Add student</Link>
          : undefined}
      />

      <Filters
        centers={user.role === "super_admin" ? centers : []}
        classes={classes}
        sessions={sessions}
        current={{ ...sp, session: String(sessionId ?? "") }}
        searchPlaceholder="Search by name, enrolment no. or phone"
        extra={[{ name: "status", label: "All statuses",
          options: ["active", "inactive", "graduated", "transferred", "dropped"]
            .map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) }]}
      />

      <Card className="mt-4 overflow-hidden" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No students found"
            hint={user.role === "teacher"
              ? "Try a different filter. Your centre manager admits new students."
              : "Try a different filter, or add the first student for this centre."}
            action={user.role !== "teacher"
              ? <Link href="/students/new" className="btn btn-primary btn-sm">Add student</Link>
              : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th><th>Enrolment no.</th><th>Class</th>
                  {!centerId && <th>Centre</th>}
                  <th>Attendance</th><th>Admitted</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/students/${r.id}`} className="flex items-center gap-2.5 hover:text-[var(--brand)]">
                        <Avatar name={fullName(r)} size={32} />
                        <span className="font-medium">{fullName(r)}</span>
                      </Link>
                    </td>
                    <td className="font-mono text-[13px] text-[var(--muted)]">{r.enrollment_no}</td>
                    <td>
                      {r.class_name
                        ? <>{r.class_name}{r.section ? ` · ${r.section}` : ""}</>
                        : <span className="text-[13px] text-[var(--faint)]">Not enrolled</span>}
                    </td>
                    {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                    <td>{r.attendance_pct === null
                      ? <span className="text-[13px] text-[var(--faint)]">—</span>
                      : <Meter value={Number(r.attendance_pct)} />}</td>
                    <td className="text-[var(--muted)]">{fmtDate(r.admission_date)}</td>
                    <td><Badge tone={STATUS_TONE[r.status]}>{r.status[0].toUpperCase() + r.status.slice(1)}</Badge></td>
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
