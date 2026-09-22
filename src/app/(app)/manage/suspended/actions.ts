"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { canTransferStudents } from "@/lib/roles";
import { today } from "@/lib/format";

type Result = { error?: string; ok?: string };

/** Statuses a child can be brought back from here. */
const RETURNABLE = new Set(["suspended", "graduated"]);

/**
 * Put a suspended or passed-out child back on the roll, at the centre and in
 * the class they are returning to. Their enrolment number, marks and history
 * are untouched; this year's enrolment is written fresh for where they are now.
 */
export async function reactivateStudent(_prev: unknown, form: FormData): Promise<Result> {
  const actor = await requireUser();
  if (!canTransferStudents(actor.role))
    return { error: "Only an admin or super admin can bring a student back." };

  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const studentId = Number(form.get("student_id"));
  const centerId = Number(form.get("center_id"));
  const classId = Number(form.get("class_id"));
  const on = String(form.get("reactivated_on") ?? "").trim() || today();
  const note = String(form.get("note") ?? "").trim() || null;
  if (!centerId) return { error: "Choose the centre they are coming back to." };
  if (!classId) return { error: "Choose their class." };
  if (on > today()) return { error: "The date cannot be in the future." };

  const s = await one<{
    name: string; status: string; center_id: number; left_reason: string | null;
    class_id: number | null;
  }>(
    `SELECT trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name, s.status,
            s.center_id, s.left_reason, e.class_level_id AS class_id
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $2
      WHERE s.id = $1`,
    [studentId, session.id]);
  if (!s) return { error: "That student could not be found." };
  if (!RETURNABLE.has(s.status))
    return { error: `${s.name} is ${s.status}, not suspended or passed out.` };

  const centre = await one<{ name: string }>(
    "SELECT name FROM centers WHERE id = $1 AND is_active", [centerId]);
  if (!centre) return { error: "That centre could not be found." };

  await tx(async (c) => {
    await c.query(
      `INSERT INTO student_reactivations
         (student_id, session_id, from_status, from_center_id, to_center_id,
          from_class_id, to_class_id, reactivated_on, left_reason, note, reactivated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [studentId, session.id, s.status, s.center_id, centerId, s.class_id, classId, on,
       s.left_reason, note, actor.uid]);

    // back on the roll: the reason they left lives on in the log above
    await c.query(
      `UPDATE students
          SET status = 'active', center_id = $2, left_on = NULL, left_reason = NULL,
              status_changed_by = $3, status_changed_at = now(), updated_at = now()
        WHERE id = $1`,
      [studentId, centerId, actor.uid]);

    await c.query(
      `INSERT INTO enrollments
         (student_id, session_id, class_level_id, center_id, enrolled_on, source, status)
       VALUES ($1,$2,$3,$4,$5,'mid_session','active')
       ON CONFLICT (student_id, session_id) DO UPDATE
         SET class_level_id = EXCLUDED.class_level_id, center_id = EXCLUDED.center_id,
             enrolled_on = EXCLUDED.enrolled_on, source = 'mid_session', status = 'active',
             section = 'M', roll_no = NULL`,
      [studentId, session.id, classId, centerId, on]);
  });

  // The list itself is left as it is, so the row can say the child is back;
  // it drops off the next time the page is opened.
  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { ok: `${s.name} is back on the roll at ${centre.name}.` };
}
