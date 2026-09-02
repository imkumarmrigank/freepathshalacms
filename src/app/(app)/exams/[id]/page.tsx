import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { Alert, Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { EXAM_TYPE_LABEL, grade, percentage } from "@/lib/exam-meta";
import MarksSheet, { type MarkRow } from "./MarksSheet";
import PublishToggle from "./PublishToggle";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const examId = Number(id);

  const exam = await one<{
    id: number; title: string; subject: string; exam_type: string; exam_date: string;
    max_marks: string; pass_marks: string | null; term_label: string | null; status: string;
    center_id: number; class_level_id: number; session_id: number;
    class_name: string; center_name: string; session_name: string; created_by_name: string | null;
  }>(
    `SELECT e.*, cl.name AS class_name, ce.name AS center_name, s.name AS session_name,
            u.name AS created_by_name
       FROM exams e
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       JOIN academic_sessions s ON s.id = e.session_id
       LEFT JOIN users u ON u.id = e.created_by
      WHERE e.id = $1`,
    [examId],
  );
  if (!exam) notFound();
  if (user.role !== "super_admin" && exam.center_id !== user.centerId)
    return <Alert kind="bad">This test belongs to another centre.</Alert>;

  // Teachers may only edit tests for a class they hold.
  let canEdit = user.role !== "teacher";
  if (user.role === "teacher") {
    const allotted = await one<{ id: number }>(
      `SELECT id FROM teacher_classes
        WHERE user_id = $1 AND session_id = $2 AND class_level_id = $3`,
      [user.uid, exam.session_id, exam.class_level_id],
    );
    canEdit = Boolean(allotted);
  }

  const rows = await query<MarkRow>(
    `SELECT s.id AS student_id, s.enrollment_no, s.first_name, s.last_name, e.roll_no,
            m.marks_obtained, COALESCE(m.is_absent, FALSE) AS is_absent
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN exam_marks m ON m.exam_id = $1 AND m.student_id = s.id
      WHERE e.session_id = $2 AND e.class_level_id = $3 AND e.center_id = $4
        AND e.status = 'active' AND s.status = 'active'
      ORDER BY e.roll_no NULLS LAST, s.first_name`,
    [examId, exam.session_id, exam.class_level_id, exam.center_id],
  );

  const max = Number(exam.max_marks);
  const pass = exam.pass_marks === null ? null : Number(exam.pass_marks);
  const scored = rows
    .filter((r) => !r.is_absent && r.marks_obtained !== null)
    .map((r) => Number(r.marks_obtained));

  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const highest = scored.length ? Math.max(...scored) : null;
  const passedCount = pass === null ? null : scored.filter((n) => n >= pass).length;

  return (
    <>
      <PageHeader
        title={exam.title}
        subtitle={`${exam.subject} · ${EXAM_TYPE_LABEL[exam.exam_type] ?? exam.exam_type} · ${
          exam.class_name} · ${exam.center_name} · ${fmtDate(exam.exam_date)}`}
        back={{ href: "/exams", label: "Tests and marks" }}
        right={
          <>
            {exam.status === "published"
              ? <Badge tone="ok">Published</Badge>
              : <Badge tone="warn">Draft</Badge>}
            {canEdit && <PublishToggle examId={exam.id} status={exam.status} />}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={rows.length} hint="on the roll" />
        <StatCard label="Class average"
          value={avg === null ? "—" : `${Math.round(avg * 10) / 10}`}
          hint={avg === null ? "no marks yet" : `out of ${max} · ${percentage(avg, max)}%`} />
        <StatCard label="Highest" value={highest === null ? "—" : highest}
          hint={highest === null ? "" : grade(percentage(highest, max))} tone="ok" />
        <StatCard label="Passed"
          value={passedCount === null ? "—" : `${passedCount}/${scored.length}`}
          hint={pass === null ? "no pass mark set" : `pass mark ${pass}`}
          tone={passedCount !== null && scored.length > 0 && passedCount < scored.length ? "warn" : "default"} />
      </div>

      {!canEdit && (
        <div className="mb-4">
          <Alert kind="info">
            You can see these results, but only a teacher allotted to {exam.class_name} or the
            centre manager can change them.
          </Alert>
        </div>
      )}
      {canEdit && exam.status === "published" && (
        <div className="mb-4">
          <Alert kind="warn">
            These results are published. Reopen the test if you need to correct a mark.
          </Alert>
        </div>
      )}

      {rows.length === 0 ? (
        <Card pad={false}>
          <Empty title="No students in this class"
            hint="Nobody is enrolled in this class for the selected centre and session." />
        </Card>
      ) : (
        <MarksSheet rows={rows} examId={exam.id} maxMarks={max} passMarks={pass}
          readOnly={!canEdit || exam.status === "published"} />
      )}
    </>
  );
}
