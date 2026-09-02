import { NextResponse } from "next/server";
import { canTouchCenter, getSession } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { percentage } from "@/lib/exam-meta";

export const dynamic = "force-dynamic";

/**
 * What the PTM form shows once a student is chosen: who they are, how their
 * attendance stands, and every test result recorded for them this session.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const studentId = Number(id);
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "No open session" }, { status: 400 });

  const student = await one<{
    id: number; enrollment_no: string; first_name: string; last_name: string | null;
    center_id: number; center_name: string; father_name: string | null;
    mother_name: string | null; primary_phone: string | null;
    class_name: string | null; class_level_id: number | null; section: string | null;
  }>(
    `SELECT s.id, s.enrollment_no, s.first_name, s.last_name, s.center_id,
            c.name AS center_name, s.father_name, s.mother_name, s.primary_phone,
            cl.name AS class_name, e.class_level_id, e.section
       FROM students s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $2
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE s.id = $1`,
    [studentId, session.id],
  );
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canTouchCenter(user, student.center_id))
    return NextResponse.json({ error: "Out of scope" }, { status: 403 });

  const att = await one<{ present: string; marked: string }>(
    `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
            count(*) FILTER (WHERE status <> 'holiday') AS marked
       FROM student_attendance WHERE student_id = $1 AND session_id = $2`,
    [studentId, session.id],
  );
  const present = Number(att?.present ?? 0);
  const marked = Number(att?.marked ?? 0);

  const marks = await query<{
    title: string; term_label: string | null; subject: string; exam_type: string;
    exam_date: string; max_marks: string; marks_obtained: string | null; is_absent: boolean;
  }>(
    `SELECT x.title, x.term_label, x.subject, x.exam_type, x.exam_date, x.max_marks,
            m.marks_obtained, m.is_absent
       FROM exam_marks m
       JOIN exams x ON x.id = m.exam_id
      WHERE m.student_id = $1 AND x.session_id = $2
      ORDER BY x.exam_date DESC, x.subject`,
    [studentId, session.id],
  );

  // group the subjects back under the test they belong to
  const tests = new Map<string, {
    title: string; type: string; date: string;
    papers: { subject: string; max: number; obtained: number | null; isAbsent: boolean }[];
    obtained: number; max: number;
  }>();
  for (const m of marks) {
    const key = `${m.exam_type}||${(m.term_label ?? m.title).toLowerCase()}`;
    let t = tests.get(key);
    if (!t) {
      t = { title: m.term_label ?? m.title, type: m.exam_type, date: m.exam_date,
            papers: [], obtained: 0, max: 0 };
      tests.set(key, t);
    }
    const obtained = m.is_absent || m.marks_obtained === null ? null : Number(m.marks_obtained);
    t.papers.push({ subject: m.subject, max: Number(m.max_marks), obtained, isAbsent: m.is_absent });
    if (obtained !== null) { t.obtained += obtained; t.max += Number(m.max_marks); }
  }
  const testList = [...tests.values()].map((t) => ({
    ...t, pct: t.max > 0 ? percentage(t.obtained, t.max) : null,
  }));

  const totalObtained = testList.reduce((n, t) => n + t.obtained, 0);
  const totalMax = testList.reduce((n, t) => n + t.max, 0);

  return NextResponse.json({
    student: {
      id: student.id,
      enrollmentNo: student.enrollment_no,
      name: `${student.first_name} ${student.last_name ?? ""}`.trim(),
      className: student.class_name,
      section: student.section,
      centerName: student.center_name,
      father: student.father_name,
      mother: student.mother_name,
      phone: student.primary_phone,
    },
    attendance: {
      present, marked,
      pct: marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
    },
    tests: testList,
    overall: {
      obtained: totalObtained,
      max: totalMax,
      pct: totalMax > 0 ? percentage(totalObtained, totalMax) : null,
    },
  });
}
