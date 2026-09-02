"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { tx, query, one } from "@/lib/db";
import { nextEnrollmentNo } from "@/lib/enrollment";
import { currentSession } from "@/lib/queries";
import { isGlobalRole, isTeaching, canMarkDropout } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function createStudent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role))
    return { error: "Only the centre manager can admit a student." };
  const session = await currentSession();
  if (!session) return { error: "No current academic session. Ask an admin to open one." };

  const centerId = isGlobalRole(user.role)
    ? Number(form.get("center_id")) : user.centerId;
  if (!centerId) return { error: "Select a centre." };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };

  const classLevelId = Number(form.get("class_level_id"));
  if (!classLevelId) return { error: "Select a class." };

  const first = str(form, "first_name");
  if (!first) return { error: "First name is required." };

  // A student joining after the session started is a mid-session admission.
  const enrolledOn = str(form, "enrolled_on") ?? new Date().toISOString().slice(0, 10);
  const source = enrolledOn > session.start_date.slice(0, 10) ? "mid_session" : "new";

  let studentId: number;
  let enrollmentNo: string;
  try {
    ({ studentId, enrollmentNo } = await tx(async (c) => {
      const no = await nextEnrollmentNo(c, centerId);
      const { rows: [s] } = await c.query<{ id: number }>(
        `INSERT INTO students (enrollment_no, center_id, first_name, last_name, gender, dob,
            father_name, mother_name, guardian_name, primary_phone, alt_phone, email,
            address, admission_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [no, centerId, first, str(form, "last_name"), str(form, "gender"), str(form, "dob"),
         str(form, "father_name"), str(form, "mother_name"), str(form, "guardian_name"),
         str(form, "primary_phone"), str(form, "alt_phone"), str(form, "email"),
         str(form, "address"), enrolledOn, str(form, "notes"), user.uid],
      );
      await c.query(
        `INSERT INTO enrollments (student_id, session_id, class_level_id, center_id,
            section, roll_no, enrolled_on, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [s.id, session.id, classLevelId, centerId, str(form, "section"),
         form.get("roll_no") ? Number(form.get("roll_no")) : null, enrolledOn, source],
      );
      return { studentId: s.id, enrollmentNo: no };
    }));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the student." };
  }

  revalidatePath("/students");
  redirect(`/students/${studentId}?created=${encodeURIComponent(enrollmentNo)}`);
}

export async function updateStudent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const existing = await one<{ center_id: number; status: string }>(
    "SELECT center_id, status FROM students WHERE id = $1", [id],
  );
  if (!existing) return { error: "Student not found." };
  if (!canTouchCenter(user, existing.center_id))
    return { error: "This student belongs to another centre." };

  // dropping a child off the roll is an administrator's call, made on its own
  // control with a reason attached — never a quiet change of this dropdown
  const status = String(form.get("status") ?? "active");
  if (status === "dropped" && existing.status !== "dropped" && !canMarkDropout(user.role))
    return { error: "Only an administrator can mark a student as dropped out." };
  if (existing.status === "dropped" && status !== "dropped" && !canMarkDropout(user.role))
    return { error: "Only an administrator can bring a dropped-out student back." };

  await query(
    `UPDATE students SET first_name=$2, last_name=$3, gender=$4, dob=$5, father_name=$6,
        mother_name=$7, guardian_name=$8, primary_phone=$9, alt_phone=$10, email=$11,
        address=$12, status=$13, notes=$14, updated_at=now()
      WHERE id=$1`,
    [id, str(form, "first_name"), str(form, "last_name"), str(form, "gender"), str(form, "dob"),
     str(form, "father_name"), str(form, "mother_name"), str(form, "guardian_name"),
     str(form, "primary_phone"), str(form, "alt_phone"), str(form, "email"),
     str(form, "address"), status, str(form, "notes")],
  );
  revalidatePath(`/students/${id}`);
  return { ok: "Saved." };
}

/** Move a student to a different class inside the same session (correction / mid-session shift). */
export async function changeClass(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const enrollmentId = Number(form.get("enrollment_id"));
  const classLevelId = Number(form.get("class_level_id"));
  const row = await one<{ center_id: number; student_id: number }>(
    "SELECT center_id, student_id FROM enrollments WHERE id = $1", [enrollmentId],
  );
  if (!row) return { error: "Enrolment not found." };
  if (isTeaching(user.role)) return { error: "Only managers can move a student between classes." };
  if (!canTouchCenter(user, row.center_id))
    return { error: "This student belongs to another centre." };

  await query("UPDATE enrollments SET class_level_id = $2 WHERE id = $1",
    [enrollmentId, classLevelId]);
  revalidatePath(`/students/${row.student_id}`);
  return { ok: "Class updated." };
}

/** Flag whether this student should move up at the end of the session. */
export async function setPromotionDecision(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role)) return { error: "Only managers can set promotion decisions." };
  const enrollmentId = Number(form.get("enrollment_id"));
  const decision = String(form.get("promotion_decision"));
  const row = await one<{ center_id: number; student_id: number }>(
    "SELECT center_id, student_id FROM enrollments WHERE id = $1", [enrollmentId],
  );
  if (!row) return { error: "Enrolment not found." };
  if (!canTouchCenter(user, row.center_id))
    return { error: "This student belongs to another centre." };

  await query("UPDATE enrollments SET promotion_decision = $2 WHERE id = $1",
    [enrollmentId, decision]);
  revalidatePath(`/students/${row.student_id}`);
  return { ok: "Promotion decision saved." };
}


/**
 * Takes a child off the roll, with the reason and the date it happened. Restricted
 * to administrators: a centre cannot quietly drop a student it is measured on.
 * The current enrolment is closed too, so the register stops expecting them.
 */
export async function markDropout(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canMarkDropout(user.role))
    return { error: "Only an administrator can mark a student as dropped out." };

  const id = Number(form.get("id"));
  const reason = str(form, "dropout_reason");
  const on = str(form, "dropout_date") ?? new Date().toISOString().slice(0, 10);
  if (!reason) return { error: "Give a reason — it is what the follow-up works from." };

  const existing = await one<{ center_id: number; status: string }>(
    "SELECT center_id, status FROM students WHERE id = $1", [id]);
  if (!existing) return { error: "Student not found." };
  if (existing.status === "dropped") return { error: "This student is already marked dropped out." };

  await tx(async (c) => {
    await c.query(
      `UPDATE students SET status = 'dropped', dropout_reason = $2, dropout_date = $3,
          updated_at = now() WHERE id = $1`,
      [id, reason, on]);
    await c.query(
      "UPDATE enrollments SET status = 'left' WHERE student_id = $1 AND status = 'active'",
      [id]);
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  return { ok: "Marked as dropped out." };
}

/** Undoes a drop-out — the child came back. */
export async function reinstateStudent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canMarkDropout(user.role))
    return { error: "Only an administrator can bring a dropped-out student back." };

  const id = Number(form.get("id"));
  const session = await currentSession();
  const existing = await one<{ status: string }>(
    "SELECT status FROM students WHERE id = $1", [id]);
  if (!existing) return { error: "Student not found." };
  if (existing.status !== "dropped") return { error: "This student is not marked dropped out." };

  await tx(async (c) => {
    await c.query(
      `UPDATE students SET status = 'active', dropout_reason = NULL, dropout_date = NULL,
          updated_at = now() WHERE id = $1`, [id]);
    if (session)
      await c.query(
        `UPDATE enrollments SET status = 'active'
          WHERE student_id = $1 AND session_id = $2 AND status = 'left'`,
        [id, session.id]);
  });

  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  return { ok: "Back on the roll." };
}
