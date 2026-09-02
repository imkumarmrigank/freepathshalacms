"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { tx, query, one } from "@/lib/db";
import { nextEnrollmentNo } from "@/lib/enrollment";
import { currentSession } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function createStudent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher")
    return { error: "Only the centre manager can admit a student." };
  const session = await currentSession();
  if (!session) return { error: "No current academic session. Ask an admin to open one." };

  const centerId = isGlobalRole(user.role)
    ? Number(form.get("center_id")) : user.centerId;
  if (!centerId) return { error: "Select a centre." };

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
  const existing = await one<{ center_id: number }>(
    "SELECT center_id FROM students WHERE id = $1", [id],
  );
  if (!existing) return { error: "Student not found." };
  if (!isGlobalRole(user.role) && existing.center_id !== user.centerId)
    return { error: "This student belongs to another centre." };

  await query(
    `UPDATE students SET first_name=$2, last_name=$3, gender=$4, dob=$5, father_name=$6,
        mother_name=$7, guardian_name=$8, primary_phone=$9, alt_phone=$10, email=$11,
        address=$12, status=$13, notes=$14, updated_at=now()
      WHERE id=$1`,
    [id, str(form, "first_name"), str(form, "last_name"), str(form, "gender"), str(form, "dob"),
     str(form, "father_name"), str(form, "mother_name"), str(form, "guardian_name"),
     str(form, "primary_phone"), str(form, "alt_phone"), str(form, "email"),
     str(form, "address"), String(form.get("status") ?? "active"), str(form, "notes")],
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
  if (user.role === "teacher") return { error: "Only managers can move a student between classes." };
  if (!isGlobalRole(user.role) && row.center_id !== user.centerId)
    return { error: "This student belongs to another centre." };

  await query("UPDATE enrollments SET class_level_id = $2 WHERE id = $1",
    [enrollmentId, classLevelId]);
  revalidatePath(`/students/${row.student_id}`);
  return { ok: "Class updated." };
}

/** Flag whether this student should move up at the end of the session. */
export async function setPromotionDecision(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher") return { error: "Only managers can set promotion decisions." };
  const enrollmentId = Number(form.get("enrollment_id"));
  const decision = String(form.get("promotion_decision"));
  const row = await one<{ center_id: number; student_id: number }>(
    "SELECT center_id, student_id FROM enrollments WHERE id = $1", [enrollmentId],
  );
  if (!row) return { error: "Enrolment not found." };
  if (!isGlobalRole(user.role) && row.center_id !== user.centerId)
    return { error: "This student belongs to another centre." };

  await query("UPDATE enrollments SET promotion_decision = $2 WHERE id = $1",
    [enrollmentId, decision]);
  revalidatePath(`/students/${row.student_id}`);
  return { ok: "Promotion decision saved." };
}
