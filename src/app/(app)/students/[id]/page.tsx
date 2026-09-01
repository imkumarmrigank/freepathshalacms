import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { listClasses } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import { fmtDate, fullName, titleCase } from "@/lib/format";
import type { Student } from "@/lib/types";
import EditStudent from "./EditStudent";
import EnrollmentControls from "./EnrollmentControls";

const STATUS_TONE: Record<string, string> = {
  active: "ok", inactive: "mute", graduated: "info", transferred: "mute", dropped: "bad",
};
const ENGAGEMENT_TONE: Record<string, string> = { attentive: "ok", neutral: "warn", resistant: "bad" };
const SOURCE_LABEL: Record<string, string> = {
  new: "New admission", promoted: "Promoted", retained: "Retained",
  mid_session: "Mid-session admission", transfer: "Transfer in",
};

export default async function StudentPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;
  const sid = Number(id);

  const student = await one<Student & { center_name: string }>(
    `SELECT s.*, c.name AS center_name FROM students s
       JOIN centers c ON c.id = s.center_id WHERE s.id = $1`, [sid],
  );
  if (!student) notFound();
  if (user.role !== "super_admin" && student.center_id !== user.centerId)
    return <Alert kind="bad">This student belongs to another centre.</Alert>;

  const [enrollments, attendance, interactions, classes] = await Promise.all([
    query<{
      id: number; session_name: string; class_name: string; class_level_id: number;
      section: string | null; roll_no: number | null; source: string; status: string;
      enrolled_on: string; is_current: boolean; promotion_decision: string;
    }>(
      `SELECT e.id, ses.name AS session_name, cl.name AS class_name, e.class_level_id,
              e.section, e.roll_no, e.source, e.status, e.enrolled_on,
              ses.is_current, e.promotion_decision
         FROM enrollments e
         JOIN academic_sessions ses ON ses.id = e.session_id
         JOIN class_levels cl ON cl.id = e.class_level_id
        WHERE e.student_id = $1 ORDER BY ses.sequence DESC`, [sid]),
    one<{ present: string; total: string }>(
      `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
              count(*) FILTER (WHERE status <> 'holiday') AS total
         FROM student_attendance WHERE student_id = $1`, [sid]),
    query<{
      id: number; interaction_date: string; engagement: string; parent_present: string;
      mentor: string | null; discussion: string | null; follow_up_required: boolean;
      follow_up_date: string | null; follow_up_status: string;
    }>(
      `SELECT i.id, i.interaction_date, i.engagement, i.parent_present, u.name AS mentor,
              i.discussion, i.follow_up_required, i.follow_up_date, i.follow_up_status
         FROM ptm_interactions i LEFT JOIN users u ON u.id = i.mentor_id
        WHERE i.student_id = $1 ORDER BY i.interaction_date DESC LIMIT 20`, [sid]),
    listClasses(),
  ]);

  const currentEnr = enrollments.find((e) => e.is_current);
  const attPct = attendance && Number(attendance.total) > 0
    ? (Number(attendance.present) / Number(attendance.total)) * 100 : null;

  return (
    <>
      {created && (
        <div className="mb-5">
          <Alert kind="ok">
            Student saved. Enrolment number <strong className="font-mono">{created}</strong> has been allotted.
          </Alert>
        </div>
      )}

      <PageHeader
        title={fullName(student)}
        subtitle={`${student.enrollment_no} · ${student.center_name}${
          currentEnr ? ` · ${currentEnr.class_name}` : ""}`}
        back={{ href: "/students", label: "Students" }}
        right={
          <>
            <Badge tone={STATUS_TONE[student.status]}>{titleCase(student.status)}</Badge>
            <Link href={`/ptm/new?student=${student.id}`} className="btn btn-primary btn-sm">
              Record interaction
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-[15px] font-semibold">Profile</h2>
            <EditStudent s={student} readOnly={false} />
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pt-5 text-[15px] font-semibold">Parent interactions</h2>
            {interactions.length === 0
              ? <Empty title="No interactions recorded"
                  action={<Link href={`/ptm/new?student=${student.id}`} className="btn btn-primary btn-sm">Record one</Link>} />
              : <ul className="mt-3">
                  {interactions.map((i) => (
                    <li key={i.id} className="border-t border-[#f1f1f6] px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/ptm/${i.id}`} className="text-[14px] font-medium hover:text-[var(--brand)]">
                          {fmtDate(i.interaction_date)}
                        </Link>
                        <Badge tone={ENGAGEMENT_TONE[i.engagement]}>{titleCase(i.engagement)}</Badge>
                        <span className="text-[13px] text-[var(--muted)]">
                          {titleCase(i.parent_present)} present{i.mentor ? ` · ${i.mentor}` : ""}
                        </span>
                        {i.follow_up_required && i.follow_up_status === "pending" && (
                          <Badge tone="warn">Follow-up {fmtDate(i.follow_up_date)}</Badge>
                        )}
                      </div>
                      {i.discussion && (
                        <p className="mt-1.5 line-clamp-2 text-[13px] text-[var(--muted)]">{i.discussion}</p>
                      )}
                    </li>
                  ))}
                </ul>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={fullName(student)} size={44} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{fullName(student)}</div>
                <div className="font-mono text-[12px] text-[var(--muted)]">{student.enrollment_no}</div>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Centre</dt><dd>{student.center_name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Admitted</dt><dd>{fmtDate(student.admission_date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Attendance</dt>
                <dd>{attPct === null ? "—" : <Meter value={attPct} />}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Days marked</dt>
                <dd>{attendance?.total ?? 0}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">Enrolment history</h2>
            {enrollments.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">Not enrolled in any session yet.</p>
            ) : (
              <ol className="space-y-3">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full"
                      style={{ background: e.is_current ? "var(--brand)" : "var(--border-strong)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium">{e.class_name}</span>
                        {e.section && <span className="text-[13px] text-[var(--muted)]">Sec {e.section}</span>}
                        {e.is_current && <Badge tone="info" dot={false}>Current</Badge>}
                      </div>
                      <div className="text-[12px] text-[var(--muted)]">
                        {e.session_name} · {SOURCE_LABEL[e.source] ?? e.source} · {fmtDate(e.enrolled_on)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {currentEnr && user.role !== "teacher" && (
              <EnrollmentControls
                enrollmentId={currentEnr.id}
                classLevelId={currentEnr.class_level_id}
                decision={currentEnr.promotion_decision}
                classes={classes}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
