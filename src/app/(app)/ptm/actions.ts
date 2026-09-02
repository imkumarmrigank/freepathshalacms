"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (f: FormData, k: string) => {
  const v = f.get(k);
  return v === null || v === "" ? null : Number(v);
};

export async function recordInteraction(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const studentId = Number(form.get("student_id"));
  if (!studentId) return { error: "Select a student." };

  const student = await one<{ center_id: number; class_level_id: number | null }>(
    `SELECT s.center_id, e.class_level_id
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $2
      WHERE s.id = $1`,
    [studentId, session.id],
  );
  if (!student) return { error: "Student not found." };
  if (!canTouchCenter(user, student.center_id))
    return { error: "This student belongs to another centre." };

  const followUp = form.get("follow_up_required") === "on";
  const followUpDate = str(form, "follow_up_date");
  if (followUp && !followUpDate) return { error: "Set a date for the follow-up." };

  const row = await one<{ id: number }>(
    `INSERT INTO ptm_interactions
       (meeting_id, student_id, session_id, class_level_id, center_id, mentor_id,
        interaction_date, mode, parent_present, engagement, attendance_pct, marks_pct,
        discussion, concerns, action_items,
        follow_up_required, follow_up_date, follow_up_mode)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING id`,
    [num(form, "meeting_id"), studentId, session.id, student.class_level_id,
     student.center_id, user.uid,
     str(form, "interaction_date") ?? new Date().toISOString().slice(0, 10),
     String(form.get("mode") ?? "in_person"),
     String(form.get("parent_present") ?? "mother"),
     String(form.get("engagement") ?? "neutral"),
     num(form, "attendance_pct"), num(form, "marks_pct"),
     str(form, "discussion"), str(form, "concerns"), str(form, "action_items"),
     followUp, followUp ? followUpDate : null,
     followUp ? str(form, "follow_up_mode") : null],
  );

  revalidatePath("/ptm");
  revalidatePath("/follow-ups");
  redirect(`/ptm/${row!.id}?created=1`);
}

export async function closeFollowUp(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const status = String(form.get("follow_up_status") ?? "done");

  const row = await one<{ center_id: number }>(
    "SELECT center_id FROM ptm_interactions WHERE id = $1", [id],
  );
  if (!row) return { error: "Interaction not found." };
  if (!canTouchCenter(user, row.center_id))
    return { error: "This record belongs to another centre." };

  await query(
    "UPDATE ptm_interactions SET follow_up_status = $2, follow_up_notes = $3 WHERE id = $1",
    [id, status, str(form, "follow_up_notes")],
  );
  revalidatePath("/follow-ups");
  revalidatePath(`/ptm/${id}`);
  return { ok: status === "done" ? "Follow-up closed." : "Follow-up cancelled." };
}

export async function scheduleMeeting(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher") return { error: "Only managers can schedule PTM days." };
  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const centerId = isGlobalRole(user.role) ? Number(form.get("center_id")) : user.centerId;
  if (!centerId) return { error: "Select a centre." };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };

  await query(
    `INSERT INTO ptm_meetings
       (title, center_id, session_id, class_level_id, meeting_date, start_time, end_time,
        mode, agenda, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [String(form.get("title") ?? "Parent-Teacher Meeting"), centerId, session.id,
     num(form, "class_level_id"), str(form, "meeting_date"),
     str(form, "start_time"), str(form, "end_time"),
     String(form.get("mode") ?? "in_person"), str(form, "agenda"), user.uid],
  );
  revalidatePath("/ptm");
  return { ok: "PTM scheduled." };
}
