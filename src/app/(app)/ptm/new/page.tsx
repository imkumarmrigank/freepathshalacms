import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, resolveCenterId } from "@/lib/queries";
import { Alert, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import InteractionForm from "./InteractionForm";

export default async function NewInteractionPage({
  searchParams,
}: { searchParams: Promise<{ student?: string }> }) {
  const user = await requireUser();
  const { student } = await searchParams;
  const session = await currentSession();
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, null);
  const params: unknown[] = [session.id];
  let scope = "";
  if (centerId) { params.push(centerId); scope = ` AND s.center_id = $${params.length}`; }

  const students = await query<{
    id: number; first_name: string; last_name: string | null; enrollment_no: string;
    center_id: number; class_name: string | null;
  }>(
    `SELECT s.id, s.first_name, s.last_name, s.enrollment_no, s.center_id,
            cl.name AS class_name
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE s.status = 'active' ${scope}
      ORDER BY s.first_name`,
    params,
  );

  // who a follow-up can be handed to, and who can be named as the mentor
  const mentors = await query<{ id: number; name: string }>(
    `SELECT u.id, u.name FROM users u
      WHERE u.is_active AND u.role <> 'super_admin'
        ${centerId ? "AND (u.center_id = $1 OR u.center_id IS NULL)" : ""}
      ORDER BY u.name`,
    centerId ? [centerId] : [],
  );

  const meetings = await query<{ id: number; title: string; meeting_date: string }>(
    `SELECT id, title, meeting_date FROM ptm_meetings
      WHERE session_id = $1 AND status IN ('scheduled','ongoing') ${
        centerId ? `AND center_id = $2` : ""}
      ORDER BY meeting_date DESC LIMIT 20`,
    centerId ? [session.id, centerId] : [session.id],
  );

  return (
    <>
      <PageHeader title="PTM Mentor Interaction"
        subtitle={`Session ${session.name}`}
        back={{ href: "/ptm", label: "PTM interactions" }} />
      <InteractionForm
        students={students.map((s) => ({
          id: s.id,
          name: `${s.first_name} ${s.last_name ?? ""}`.replace(/\s+/g, " ").trim(),
          enrollmentNo: s.enrollment_no,
          centerId: s.center_id,
          className: s.class_name,
        }))}
        centers={centers}
        mentors={mentors}
        mentorName={user.name}
        defaultStudentId={student ? Number(student) : null}
        meetings={meetings.map((m) => ({ id: m.id, label: `${m.title} — ${fmtDate(m.meeting_date)}` }))}
      />
    </>
  );
}
