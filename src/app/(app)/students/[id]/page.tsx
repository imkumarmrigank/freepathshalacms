import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { listClasses } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { fmtDate, fullName, titleCase } from "@/lib/format";
import { EXAM_TYPE_LABEL, grade, percentage } from "@/lib/exam-meta";
import { canEditStudents, canMarkDropout, can } from "@/lib/roles";
import type { Student } from "@/lib/types";
import EditStudent from "./EditStudent";
import AdmissionRecord from "./AdmissionRecord";
import DropoutControl from "./DropoutControl";
import FlagForCounselling, { type OpenFlag } from "./FlagForCounselling";
import EnrollmentControls from "./EnrollmentControls";
import { isGlobalRole, isTeaching } from "@/lib/roles";

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
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; flag?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { created, flag: openFlag } = await searchParams;
  const sid = Number(id);

  const student = await one<Student & { center_name: string }>(
    `SELECT s.*, c.name AS center_name FROM students s
       JOIN centers c ON c.id = s.center_id WHERE s.id = $1`, [sid],
  );
  if (!student) notFound();
  if (!canTouchCenter(user, student.center_id))
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

  // every class change a promotion made, newest first
  const moves = await query<{
    id: number; decision: string; basis: string; reason: string | null;
    recommended_by: string | null; moved_on: string;
    from_class: string | null; to_class: string | null; moved_by_name: string | null;
  }>(
    `SELECT pm.id, pm.decision, pm.basis, pm.reason, pm.recommended_by, pm.moved_on,
            f.name AS from_class, tcl.name AS to_class, u.name AS moved_by_name
       FROM promotion_moves pm
       LEFT JOIN class_levels f ON f.id = pm.from_class_level_id
       LEFT JOIN class_levels tcl ON tcl.id = pm.to_class_level_id
       LEFT JOIN users u ON u.id = pm.moved_by
      WHERE pm.student_id = $1
      ORDER BY pm.moved_on DESC, pm.id DESC LIMIT 12`,
    [sid],
  );

  // the live counselling referral, if the child has one
  const flag = await one<OpenFlag>(
    `SELECT f.id, f.status, f.urgency, f.reasons, f.note, f.raised_on,
            u.name AS raised_by_name
       FROM counselling_flags f
       LEFT JOIN users u ON u.id = f.raised_by
      WHERE f.student_id = $1 AND f.status <> 'closed'
      ORDER BY f.id DESC LIMIT 1`,
    [sid],
  );

  const marks = await query<{
    exam_id: number; title: string; subject: string; exam_type: string; exam_date: string;
    max_marks: string; marks_obtained: string | null; is_absent: boolean;
  }>(
    `SELECT x.id AS exam_id, x.title, x.subject, x.exam_type, x.exam_date, x.max_marks,
            m.marks_obtained, COALESCE(m.is_absent, FALSE) AS is_absent
       FROM exam_marks m
       JOIN exams x ON x.id = m.exam_id
      WHERE m.student_id = $1
      ORDER BY x.exam_date DESC LIMIT 12`,
    [sid],
  );

  const currentEnr = enrollments.find((e) => e.is_current);
  // the class directly above the one they are in, for the promote-now control
  const ladder = classes.map((c) => c.id);
  const atIndex = currentEnr ? ladder.indexOf(currentEnr.class_level_id) : -1;
  const nextClassName = atIndex >= 0 && atIndex + 1 < classes.length
    ? classes[atIndex + 1].name : null;
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
            <Link href={`/students/${student.id}/report-card`} className="btn btn-ghost btn-sm">
              Progress report
            </Link>
            <Link href={`/ptm/new?student=${student.id}`} className="btn btn-primary btn-sm">
              <IconPlus className="h-3.5 w-3.5" /> Record Parent Interaction
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-[15px] font-semibold">Profile</h2>
            <EditStudent s={student} readOnly={!canEditStudents(user.role)}
              canDrop={canMarkDropout(user.role)} />
          </Card>

          <Card>
            <h2 className="mb-4 text-[15px] font-semibold">Admission record</h2>
            <AdmissionRecord s={student} />
          </Card>

          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <h2 className="text-[15px] font-semibold">Test results</h2>
              <Link href={`/students/${student.id}/report-card`}
                className="text-[13px] text-[var(--brand)] hover:underline">
                Printable progress report →
              </Link>
            </div>
            {marks.length === 0 ? (
              <Empty title="No marks recorded yet"
                hint="Results appear here once a teacher enters them against a test." />
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Test</th><th>Subject</th><th>Date</th>
                      <th className="text-right">Marks</th><th className="text-right">Grade</th></tr>
                  </thead>
                  <tbody>
                    {marks.map((m) => {
                      const obtained = m.is_absent || m.marks_obtained === null
                        ? null : Number(m.marks_obtained);
                      const pct = obtained === null
                        ? null : percentage(obtained, Number(m.max_marks));
                      return (
                        <tr key={m.exam_id}>
                          <td>
                            <Link href={`/exams/${m.exam_id}`} className="font-medium hover:text-[var(--brand)]">
                              {m.title}
                            </Link>
                            <div className="text-[12px] text-[var(--muted)]">
                              {EXAM_TYPE_LABEL[m.exam_type] ?? m.exam_type}
                            </div>
                          </td>
                          <td className="text-[var(--muted)]">{m.subject}</td>
                          <td className="whitespace-nowrap text-[var(--muted)]">{fmtDate(m.exam_date)}</td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {m.is_absent
                              ? <Badge tone="mute">Absent</Badge>
                              : <>{obtained}<span className="text-[var(--faint)]"> / {Number(m.max_marks)}</span></>}
                          </td>
                          <td className="text-right">
                            {pct === null
                              ? <span className="text-[var(--faint)]">—</span>
                              : <Badge tone={pct >= 60 ? "ok" : pct >= 40 ? "warn" : "bad"} dot={false}>
                                  {grade(pct)} · {pct}%
                                </Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pt-5 text-[15px] font-semibold">Parent interactions</h2>
            {interactions.length === 0
              ? <Empty title="No interactions recorded"
                  action={
                    <Link href={`/ptm/new?student=${student.id}`} className="btn btn-primary btn-sm">
                      <IconPlus className="h-3.5 w-3.5" /> Record Parent Interaction
                    </Link>
                  } />
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
              <Avatar name={fullName(student)} size={44}
                src={student.photo_media_id ? `/api/media/${student.photo_media_id}` : null} />
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

          {can(user.role, "counselling") && (
            <FlagForCounselling studentId={student.id} flag={flag}
              canRaise={user.role !== "mentor"} startOpen={openFlag === "1"} />
          )}

          {canMarkDropout(user.role) && (
            <DropoutControl studentId={student.id} status={student.status}
              reason={student.dropout_reason} on={student.dropout_date} />
          )}

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
            {moves.length > 0 && (
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <h3 className="label-cap mb-2">Promotions</h3>
                <ul className="space-y-2">
                  {moves.map((m) => (
                    <li key={m.id} className="text-[12px] text-[var(--muted)]">
                      <span className="font-medium text-[var(--text)]">
                        {m.decision === "graduated"
                          ? "Graduated"
                          : `${m.from_class ?? "—"} → ${m.to_class ?? "—"}`}
                      </span>
                      {" · "}{fmtDate(m.moved_on)}
                      {" · "}
                      {m.basis === "result" ? "on the year's result"
                        : m.basis === "no_result" ? "no marks on record"
                        : m.recommended_by ?? "by hand"}
                      {m.reason ? ` — ${m.reason}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentEnr && !isTeaching(user.role) && (
              <EnrollmentControls
                enrollmentId={currentEnr.id}
                classLevelId={currentEnr.class_level_id}
                decision={currentEnr.promotion_decision}
                classes={classes}
                nextClassName={nextClassName}
                meetings={interactions.map((i) => ({
                  id: i.id,
                  label: `${fmtDate(i.interaction_date)}${i.mentor ? ` · ${i.mentor}` : ""}`,
                }))}
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
