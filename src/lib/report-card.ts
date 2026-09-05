import "server-only";
import { one, query } from "./db";
import { isCoScholastic, percentage } from "./exam-meta";

export type Paper = {
  subject: string;
  max: number;
  obtained: number | null;
  isAbsent: boolean;
  pass: number | null;
};

export type TestBlock = {
  key: string;
  title: string;
  type: string;
  date: string;
  papers: Paper[];
  /** Behaviour, activities and the like — shown, but never added to the total. */
  co: Paper[];
  obtained: number;
  max: number;
  graded: number;
};

export type ReportCardData = {
  student: {
    id: number; enrollment_no: string; first_name: string; last_name: string | null;
    dob: string | null; father_name: string | null; mother_name: string | null;
    admission_date: string; center_id: number; photo_media_id: number | null;
    center_name: string; center_code: string; center_address: string | null;
    center_area: string | null; center_city: string | null; center_state: string | null;
    center_pincode: string | null; center_phone: string | null;
  };
  enrollment: {
    class_name: string; section: string | null; roll_no: number | null; session_name: string;
  } | null;
  tests: TestBlock[];
  totalObtained: number;
  totalMax: number;
  overallPct: number | null;
  anyGraded: boolean;
  /** True when any test recorded behaviour or activities worth showing. */
  anyCo: boolean;
  attendance: { present: number; marked: number; pct: number | null };
};

/**
 * Everything one report card needs. Shared by the single card and the class-wide
 * print sheet so the two can never drift apart.
 */
export async function loadReportCard(
  studentId: number,
  sessionId: number,
): Promise<ReportCardData | null> {
  const student = await one<ReportCardData["student"]>(
    `SELECT s.id, s.enrollment_no, s.first_name, s.last_name, s.dob,
            s.father_name, s.mother_name, s.admission_date, s.center_id,
            s.photo_media_id,
            c.name AS center_name, c.code AS center_code, c.address AS center_address,
            c.area AS center_area, c.city AS center_city, c.state AS center_state,
            c.pincode AS center_pincode, c.phone AS center_phone
       FROM students s JOIN centers c ON c.id = s.center_id
      WHERE s.id = $1`,
    [studentId],
  );
  if (!student) return null;

  const enrollment = await one<NonNullable<ReportCardData["enrollment"]>>(
    `SELECT cl.name AS class_name, e.section, e.roll_no, a.name AS session_name
       FROM enrollments e
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN academic_sessions a ON a.id = e.session_id
      WHERE e.student_id = $1 AND e.session_id = $2`,
    [studentId, sessionId],
  );

  const marks = await query<{
    title: string; subject: string; exam_type: string; exam_date: string;
    term_label: string | null; max_marks: string; pass_marks: string | null;
    marks_obtained: string | null; is_absent: boolean;
  }>(
    `SELECT x.title, x.subject, x.exam_type, x.exam_date, x.term_label,
            x.max_marks, x.pass_marks,
            m.marks_obtained, COALESCE(m.is_absent, FALSE) AS is_absent
       FROM exams x
       LEFT JOIN exam_marks m ON m.exam_id = x.id AND m.student_id = $1
      WHERE x.session_id = $2 AND x.center_id = $3
        AND x.class_level_id = (SELECT class_level_id FROM enrollments
                                 WHERE student_id = $1 AND session_id = $2)
        -- a session runs April to March; an exam dated outside it belongs to
        -- another year's report, whatever session row it happens to carry
        AND x.exam_date BETWEEN (SELECT start_date FROM academic_sessions WHERE id = $2)
                            AND (SELECT end_date   FROM academic_sessions WHERE id = $2)
      ORDER BY x.exam_date, x.subject`,
    [studentId, sessionId, student.center_id],
  );

  // Same type + term label = the same test, seen across its subjects.
  const byTest = new Map<string, TestBlock>();
  for (const m of marks) {
    const key = `${m.exam_type}||${(m.term_label ?? m.title).toLowerCase()}`;
    let t = byTest.get(key);
    if (!t) {
      t = { key, title: m.term_label ?? m.title, type: m.exam_type, date: m.exam_date,
            papers: [], co: [], obtained: 0, max: 0, graded: 0 };
      byTest.set(key, t);
    }
    const obtained = m.is_absent || m.marks_obtained === null ? null : Number(m.marks_obtained);
    const paper: Paper = {
      subject: m.subject, max: Number(m.max_marks), obtained,
      isAbsent: m.is_absent, pass: m.pass_marks === null ? null : Number(m.pass_marks),
    };
    if (isCoScholastic(m.subject)) {
      t.co.push(paper);
    } else {
      t.papers.push(paper);
      // The maximum counts every paper in the test, whether the child sat it or
      // not, so the Max column on the card adds up to the figure beneath it.
      // Totalling only the graded papers made a test out of 70 report itself as
      // out of 40, and turned 14 marks into 35% instead of 20%.
      t.max += Number(m.max_marks);
      if (obtained !== null) { t.obtained += obtained; t.graded += 1; }
    }
    if (m.exam_date < t.date) t.date = m.exam_date;
  }
  const tests = [...byTest.values()].sort((a, b) => a.date.localeCompare(b.date));

  // A test the child partly sat counts in full — that is the point of the change
  // above. A test with nothing graded at all counts for nothing: it is as likely
  // to mean the paper was never entered as that the child scored zero, and a
  // teacher's unfinished paperwork should not read as a child's failure.
  const sat = tests.filter((t) => t.graded > 0);
  const totalObtained = sat.reduce((n, t) => n + t.obtained, 0);
  const totalMax = sat.reduce((n, t) => n + t.max, 0);

  const att = await one<{ present: string; marked: string }>(
    `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
            count(*) FILTER (WHERE status <> 'holiday') AS marked
       FROM student_attendance WHERE student_id = $1 AND session_id = $2`,
    [studentId, sessionId],
  );
  const present = Number(att?.present ?? 0);
  const marked = Number(att?.marked ?? 0);

  return {
    student,
    enrollment,
    tests,
    totalObtained,
    totalMax,
    overallPct: totalMax > 0 ? percentage(totalObtained, totalMax) : null,
    anyGraded: tests.some((t) => t.graded > 0),
    anyCo: tests.some((t) => t.co.some((p) => p.obtained !== null || p.isAbsent)),
    attendance: {
      present, marked,
      pct: marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
    },
  };
}

/** Class roster with just enough to list and rank them on the progress page. */
export async function classProgress(
  sessionId: number,
  centerId: number | null,
  classLevelId: number | null,
) {
  const params: unknown[] = [sessionId];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND e.center_id = $${params.length}`; }
  if (classLevelId) { params.push(classLevelId); where += ` AND e.class_level_id = $${params.length}`; }

  return query<{
    student_id: number; enrollment_no: string; first_name: string; last_name: string | null;
    roll_no: number | null; class_name: string; center_name: string;
    obtained: string | null; out_of: string | null; papers: string; tests: string;
    attendance_pct: string | null;
  }>(
    `SELECT s.id AS student_id, s.enrollment_no, s.first_name, s.last_name, e.roll_no,
            cl.name AS class_name, ce.name AS center_name,
            m.obtained, m.out_of, COALESCE(m.papers, 0) AS papers, COALESCE(m.tests, 0) AS tests,
            (SELECT round(100.0 * count(*) FILTER (WHERE a.status IN ('present','late','half_day'))
                    / NULLIF(count(*) FILTER (WHERE a.status <> 'holiday'), 0), 1)
               FROM student_attendance a WHERE a.enrollment_id = e.id) AS attendance_pct
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       LEFT JOIN LATERAL (
         SELECT sum(em.marks_obtained) AS obtained,
                sum(x.max_marks) FILTER (WHERE em.marks_obtained IS NOT NULL) AS out_of,
                count(*) FILTER (WHERE em.marks_obtained IS NOT NULL) AS papers,
                count(DISTINCT (x.exam_type, COALESCE(x.term_label, x.title))) AS tests
           FROM exam_marks em
           JOIN exams x ON x.id = em.exam_id
          WHERE em.student_id = s.id AND x.session_id = e.session_id
       ) m ON TRUE
      WHERE e.session_id = $1 AND e.status = 'active' AND s.status = 'active' ${where}
      ORDER BY ce.code, cl.sequence, e.roll_no NULLS LAST, s.first_name`,
    params,
  );
}
