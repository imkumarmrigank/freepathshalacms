"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { currentSession } from "@/lib/queries";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** A teacher may only work on classes they hold this session. */
async function assertCanTouchClass(
  user: Awaited<ReturnType<typeof requireUser>>,
  sessionId: number,
  classLevelId: number,
  centerId: number,
) {
  if (user.role === "super_admin") return null;
  if (centerId !== user.centerId) return "That class is at another centre.";
  if (user.role === "center_manager") return null;
  const allotted = await one<{ id: number }>(
    `SELECT id FROM teacher_classes
      WHERE user_id = $1 AND session_id = $2 AND class_level_id = $3`,
    [user.uid, sessionId, classLevelId],
  );
  return allotted ? null : "You are not allotted to this class. Ask your centre manager.";
}

export async function createExam(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const title = str(form, "title");
  const subject = str(form, "subject");
  const classLevelId = Number(form.get("class_level_id"));
  const examDate = str(form, "exam_date");
  const maxMarks = Number(form.get("max_marks"));
  const passRaw = str(form, "pass_marks");
  const passMarks = passRaw === null ? null : Number(passRaw);

  if (!title || !subject || !classLevelId || !examDate)
    return { error: "Title, subject, class and date are all required." };
  if (!Number.isFinite(maxMarks) || maxMarks <= 0)
    return { error: "Maximum marks must be greater than zero." };
  if (passMarks !== null && (!Number.isFinite(passMarks) || passMarks < 0 || passMarks > maxMarks))
    return { error: "Pass marks must be between zero and the maximum." };

  const centerId = user.role === "super_admin"
    ? Number(form.get("center_id")) || null
    : user.centerId;
  if (!centerId) return { error: "Pick a centre." };

  const denied = await assertCanTouchClass(user, session.id, classLevelId, centerId);
  if (denied) return { error: denied };

  const row = await one<{ id: number }>(
    `INSERT INTO exams (title, exam_type, subject, center_id, session_id, class_level_id,
        exam_date, max_marks, pass_marks, term_label, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [title, String(form.get("exam_type") ?? "monthly"), subject, centerId, session.id,
     classLevelId, examDate, maxMarks, passMarks, str(form, "term_label"), user.uid],
  );

  revalidatePath("/exams");
  redirect(`/exams/${row!.id}`);
}

/** Saves the whole class's marks in one go. */
export async function saveMarks(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const examId = Number(form.get("exam_id"));

  const exam = await one<{
    id: number; center_id: number; class_level_id: number; session_id: number;
    max_marks: string; status: string;
  }>(
    "SELECT id, center_id, class_level_id, session_id, max_marks, status FROM exams WHERE id = $1",
    [examId],
  );
  if (!exam) return { error: "Test not found." };

  const denied = await assertCanTouchClass(user, exam.session_id, exam.class_level_id, exam.center_id);
  if (denied) return { error: denied };

  const max = Number(exam.max_marks);
  type Entry = { studentId: number; marks: number | null; absent: boolean };
  const entries: Entry[] = [];

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("m_")) continue;
    const studentId = Number(key.slice(2));
    if (!studentId) continue;
    const absent = form.get(`a_${studentId}`) === "on";
    const raw = String(value).trim();

    if (absent) { entries.push({ studentId, marks: null, absent: true }); continue; }
    if (raw === "") { entries.push({ studentId, marks: null, absent: false }); continue; }

    const marks = Number(raw);
    if (!Number.isFinite(marks) || marks < 0)
      return { error: "Marks must be a number of zero or more." };
    if (marks > max)
      return { error: `Marks cannot be above the maximum of ${max}.` };
    entries.push({ studentId, marks, absent: false });
  }

  if (entries.length === 0) return { error: "Nothing to save." };

  let saved = 0;
  try {
    await tx(async (c) => {
      const ids = entries.map((e) => e.studentId);
      // only students actually enrolled in this exam's class may be graded
      const { rows } = await c.query<{ student_id: number; id: number }>(
        `SELECT student_id, id FROM enrollments
          WHERE student_id = ANY($1::bigint[]) AND session_id = $2
            AND class_level_id = $3 AND center_id = $4`,
        [ids, exam.session_id, exam.class_level_id, exam.center_id],
      );
      const enrollmentOf = new Map(rows.map((r) => [r.student_id, r.id]));

      for (const e of entries) {
        const enrollmentId = enrollmentOf.get(e.studentId);
        if (!enrollmentId) continue;
        await c.query(
          `INSERT INTO exam_marks
             (exam_id, student_id, enrollment_id, marks_obtained, is_absent, entered_by, entered_at)
           VALUES ($1,$2,$3,$4,$5,$6, now())
           ON CONFLICT (exam_id, student_id) DO UPDATE
             SET marks_obtained = EXCLUDED.marks_obtained,
                 is_absent = EXCLUDED.is_absent,
                 enrollment_id = EXCLUDED.enrollment_id,
                 entered_by = EXCLUDED.entered_by,
                 entered_at = now()`,
          [examId, e.studentId, enrollmentId, e.marks, e.absent, user.uid],
        );
        saved++;
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the marks." };
  }

  if (saved === 0) return { error: "Nothing was saved — the roster no longer matches this class." };
  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
  return { ok: `Marks saved for ${saved} student${saved === 1 ? "" : "s"}.` };
}

export async function setExamStatus(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const examId = Number(form.get("exam_id"));
  const status = String(form.get("status"));
  const exam = await one<{ center_id: number; class_level_id: number; session_id: number }>(
    "SELECT center_id, class_level_id, session_id FROM exams WHERE id = $1", [examId]);
  if (!exam) return { error: "Test not found." };
  const denied = await assertCanTouchClass(user, exam.session_id, exam.class_level_id, exam.center_id);
  if (denied) return { error: denied };

  await query("UPDATE exams SET status = $2 WHERE id = $1", [examId, status]);
  revalidatePath(`/exams/${examId}`);
  return { ok: status === "published" ? "Results published." : "Reopened for editing." };
}

export async function deleteExam(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher") return { error: "Ask your centre manager to delete a test." };
  const examId = Number(form.get("exam_id"));
  const exam = await one<{ center_id: number }>(
    "SELECT center_id FROM exams WHERE id = $1", [examId]);
  if (!exam) return { error: "Test not found." };
  if (user.role !== "super_admin" && exam.center_id !== user.centerId)
    return { error: "That test belongs to another centre." };

  await query("DELETE FROM exams WHERE id = $1", [examId]);
  revalidatePath("/exams");
  redirect("/exams");
}
