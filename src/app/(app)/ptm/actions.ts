"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { isGlobalRole, isTeaching } from "@/lib/roles";

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

  // the form's required questions, checked here and not only in the browser
  const parentPresent = String(form.get("parent_present") ?? "");
  const engagement = String(form.get("engagement") ?? "");
  const priority = String(form.get("follow_up_priority") ?? "");
  const followUpDate = str(form, "follow_up_date");
  const confidence = form.get("confidence") ? Number(form.get("confidence")) : null;

  if (!parentPresent) return { error: "Say who attended." };
  if (!engagement) return { error: "Record the parent's engagement level." };
  if (!priority) return { error: "Set the follow-up priority." };
  if (!followUpDate) return { error: "Set the next follow-up date." };
  if (confidence === null || confidence < 1 || confidence > 5)
    return { error: "Rate your confidence in this family's progress from 1 to 5." };

  const concernTags = form.getAll("concern_tags").map(String).filter(Boolean);
  const commitmentTags = form.getAll("commitment_tags").map(String).filter(Boolean);
  if (concernTags.length === 0) return { error: "Choose at least one concern discussed." };
  if (commitmentTags.length === 0)
    return { error: "Record at least one commitment the parent made." };

  const interactionDate = str(form, "interaction_date") ?? new Date().toISOString().slice(0, 10);
  if (interactionDate > new Date().toISOString().slice(0, 10))
    return { error: "The interaction cannot be dated in the future." };

  // whoever is named as the mentor, defaulting to the person filling this in
  const mentorId = form.get("mentor_id") ? Number(form.get("mentor_id")) : user.uid;
  const assigneeRaw = form.get("follow_up_assignee_id");
  const assigneeId = assigneeRaw && String(assigneeRaw) !== "" ? Number(assigneeRaw) : mentorId;

  // attendance is already known, so it is taken from the record rather than typed
  const att = await one<{ present: string; marked: string }>(
    `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
            count(*) FILTER (WHERE status <> 'holiday') AS marked
       FROM student_attendance WHERE student_id = $1 AND session_id = $2`,
    [studentId, session.id],
  );
  const marked = Number(att?.marked ?? 0);
  const attendancePct = marked > 0
    ? Math.round((Number(att!.present) / marked) * 1000) / 10 : null;

  const row = await one<{ id: number }>(
    `INSERT INTO ptm_interactions
       (meeting_id, student_id, session_id, class_level_id, center_id, mentor_id,
        interaction_date, mode, parent_present, engagement, attendance_pct,
        discussion, concerns, action_items, concern_tags, commitment_tags,
        follow_up_required, follow_up_date, follow_up_priority, follow_up_owner,
        follow_up_assignee_id, confidence, support_needed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
             TRUE,$17,$18,$19,$20,$21,$22)
     RETURNING id`,
    [num(form, "meeting_id"), studentId, session.id, student.class_level_id,
     student.center_id, mentorId,
     interactionDate, String(form.get("mode") ?? "in_person"),
     parentPresent, engagement, attendancePct,
     str(form, "discussion"), str(form, "concerns"), str(form, "action_items"),
     concernTags, commitmentTags,
     followUpDate, priority, str(form, "follow_up_owner"),
     assigneeId, confidence, str(form, "support_needed")],
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

/** Hand an open follow-up to a teacher, or take it back. */
export async function assignFollowUp(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const raw = String(form.get("follow_up_assignee_id") ?? "");
  const assignee = raw === "" ? null : Number(raw);

  const row = await one<{ center_id: number }>(
    "SELECT center_id FROM ptm_interactions WHERE id = $1", [id]);
  if (!row) return { error: "Interaction not found." };
  if (!canTouchCenter(user, row.center_id))
    return { error: "This record belongs to another centre." };

  if (assignee !== null) {
    const target = await one<{ role: string; center_id: number | null }>(
      "SELECT role, center_id FROM users WHERE id = $1 AND is_active", [assignee]);
    if (!target) return { error: "That person could not be found." };
    if (!["teacher", "backup_teacher", "center_manager"].includes(target.role))
      return { error: "Follow-ups are assigned to teachers and centre managers." };
    if (target.center_id !== row.center_id && target.role !== "backup_teacher")
      return { error: "That teacher is at another centre." };
  }

  await query("UPDATE ptm_interactions SET follow_up_assignee_id = $2 WHERE id = $1",
    [id, assignee]);
  revalidatePath("/follow-ups");
  revalidatePath(`/ptm/${id}`);
  return { ok: assignee === null ? "Follow-up left with you." : "Follow-up assigned." };
}

export async function scheduleMeeting(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role)) return { error: "Only managers can schedule PTM days." };
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
