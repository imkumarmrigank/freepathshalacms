"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { canTransferStudents } from "@/lib/roles";
import { today } from "@/lib/format";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/**
 * Move a child to another centre, and optionally another class.
 *
 * What always goes with them: the child, this year's enrolment, and any
 * referral still open with the mentor, because that work now belongs to the
 * new centre.
 *
 * What goes if the office says so (the default): this year's attendance and
 * closed referrals, so the new centre sees the year whole.
 *
 * What never moves: PTM records, which stay with the centre that held the
 * meeting so its record of the family's progress stays whole; marks, which belong to the tests the old centre set (the
 * report card follows the child to them anyway); supplies handed out, which
 * are part of the old centre's stock count; earlier years' enrolments, which
 * record where the child studied that year; and the enrolment number, which is
 * the child's identity on paper as well as here.
 */
export async function transferStudent(_prev: unknown, form: FormData): Promise<Result> {
  const actor = await requireUser();
  if (!canTransferStudents(actor.role))
    return { error: "Only an admin or super admin can transfer a student." };

  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const studentId = Number(form.get("student_id"));
  const toCenterId = Number(form.get("to_center_id"));
  const toClassRaw = Number(form.get("to_class_id")) || null;
  const on = str(form, "transferred_on") ?? today();
  const moveHistory = form.get("move_history") === "on";

  if (!studentId) return { error: "Choose the student." };
  if (!toCenterId) return { error: "Choose the centre they are moving to." };
  if (on > today()) return { error: "A transfer cannot be dated in the future." };

  const student = await one<{
    id: number; name: string; enrollment_no: string; center_id: number; status: string;
    enrollment_id: number | null; class_level_id: number | null;
  }>(
    `SELECT s.id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name,
            s.enrollment_no, s.center_id, s.status,
            e.id AS enrollment_id, e.class_level_id
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $2
      WHERE s.id = $1`,
    [studentId, session.id]);
  if (!student) return { error: "That student could not be found." };
  if (student.status !== "active")
    return { error: `${student.name} is not on the roll (${student.status}); only an active child can be transferred.` };
  if (student.center_id === toCenterId)
    return { error: `${student.name} is already at that centre. To change only the class, edit the student.` };

  const to = await one<{ name: string }>(
    "SELECT name FROM centers WHERE id = $1 AND is_active", [toCenterId]);
  if (!to) return { error: "That centre could not be found." };

  const toClass = toClassRaw ?? student.class_level_id;
  if (student.enrollment_id && !toClass) return { error: "Choose the class." };
  if (toClass) {
    const ok = await one("SELECT 1 FROM class_levels WHERE id = $1", [toClass]);
    if (!ok) return { error: "That class could not be found." };
  }

  const moved = await tx(async (c) => {
    const from = student.center_id;

    await c.query("UPDATE students SET center_id = $2, updated_at = now() WHERE id = $1",
      [student.id, toCenterId]);

    if (student.enrollment_id) {
      // a new room: the old roll number means nothing there; the section (M or
      // E) is kept, and the office can change it at the new centre
      await c.query(
        `UPDATE enrollments
            SET center_id = $2, class_level_id = $3, roll_no = NULL,
                source = 'transfer'
          WHERE id = $1`,
        [student.enrollment_id, toCenterId, toClass]);
    }

    // PTM records stay where the meeting happened: they are that centre's
    // account of the family, and the child's page shows them wherever the
    // child is now. Open referrals are live work, so they follow the child.
    const openFlags = await c.query(
      `UPDATE counselling_flags SET center_id = $2
        WHERE student_id = $1 AND status <> 'closed' AND center_id <> $2`,
      [student.id, toCenterId]);

    let attendance = 0, referrals = openFlags.rowCount ?? 0;
    if (moveHistory) {
      attendance = (await c.query(
        `UPDATE student_attendance SET center_id = $2
          WHERE student_id = $1 AND session_id = $3 AND center_id <> $2`,
        [student.id, toCenterId, session.id])).rowCount ?? 0;
      referrals += (await c.query(
        `UPDATE counselling_flags SET center_id = $2
          WHERE student_id = $1 AND session_id = $3 AND center_id <> $2`,
        [student.id, toCenterId, session.id])).rowCount ?? 0;
    }

    // Sports are the old centre's own games; the child leaves them.
    const sports = (await c.query(
      `UPDATE sport_students ss SET left_on = $3
         FROM sports sp
        WHERE ss.sport_id = sp.id AND ss.student_id = $1
          AND sp.center_id = $2 AND ss.left_on IS NULL`,
      [student.id, from, on])).rowCount ?? 0;

    await c.query(
      `INSERT INTO student_transfers
         (student_id, session_id, from_center_id, to_center_id, from_class_id, to_class_id,
          transferred_on, reason, moved_history, moved_attendance, moved_ptm,
          moved_referrals, left_sports, transferred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,$12,$13)`,
      [student.id, session.id, from, toCenterId, student.class_level_id, toClass, on,
       str(form, "reason"), moveHistory, attendance, referrals, sports, actor.uid]);

    return { attendance, referrals, sports };
  });

  revalidatePath("/manage/transfers");
  revalidatePath("/students");
  revalidatePath(`/students/${student.id}`);

  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const bits = [
    moved.attendance && n(moved.attendance, "attendance day", "attendance days"),
    moved.referrals && n(moved.referrals, "referral", "referrals"),
  ].filter(Boolean);
  return {
    ok: `${student.name} (${student.enrollment_no}) is now at ${to.name}.`
      + (bits.length ? ` Moved with them: ${bits.join(", ")}.` : "")
      + (moved.sports ? ` Left ${moved.sports} sport${moved.sports === 1 ? "" : "s"} at the old centre.` : ""),
  };
}
