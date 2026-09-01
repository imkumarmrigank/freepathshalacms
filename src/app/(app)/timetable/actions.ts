"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function saveSlot(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher")
    return { error: "Only centre managers and admins can change the timetable." };

  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const centerId = user.role === "super_admin"
    ? Number(form.get("center_id")) : user.centerId;
  if (!centerId) return { error: "Pick a centre." };

  const classLevelId = Number(form.get("class_level_id"));
  const dayOfWeek = Number(form.get("day_of_week"));
  const periodNo = Number(form.get("period_no"));
  const subject = str(form, "subject");
  const startTime = str(form, "start_time");
  const endTime = str(form, "end_time");
  const teacherId = form.get("teacher_id") ? Number(form.get("teacher_id")) : null;

  if (!classLevelId || !dayOfWeek || !periodNo || !subject || !startTime || !endTime)
    return { error: "Class, day, period, subject and both times are required." };
  if (endTime <= startTime) return { error: "The end time must be after the start time." };

  if (teacherId) {
    const t = await one<{ center_id: number | null; role: string }>(
      "SELECT center_id, role FROM users WHERE id = $1 AND is_active", [teacherId]);
    if (!t) return { error: "Teacher not found." };
    if (t.center_id !== centerId) return { error: "That teacher is not at this centre." };
  }

  const id = form.get("id") ? Number(form.get("id")) : null;

  try {
    if (id) {
      await query(
        `UPDATE timetable_slots SET class_level_id=$2, day_of_week=$3, period_no=$4,
            start_time=$5, end_time=$6, subject=$7, teacher_id=$8, room=$9
          WHERE id=$1 AND center_id=$10`,
        [id, classLevelId, dayOfWeek, periodNo, startTime, endTime, subject,
         teacherId, str(form, "room"), centerId],
      );
    } else {
      await query(
        `INSERT INTO timetable_slots (center_id, session_id, class_level_id, day_of_week,
            period_no, start_time, end_time, subject, teacher_id, room, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [centerId, session.id, classLevelId, dayOfWeek, periodNo, startTime, endTime,
         subject, teacherId, str(form, "room"), user.uid],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the slot.";
    if (msg.includes("timetable_teacher_busy"))
      return { error: "That teacher is already taking another class in this period." };
    if (msg.includes("timetable_slots_center_id_session_id_class_level_id_day_of_w"))
      return { error: "This class already has a subject in that period. Edit it instead." };
    return { error: msg };
  }

  revalidatePath("/timetable");
  return { ok: id ? "Slot updated." : "Slot added to the timetable." };
}

export async function deleteSlot(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher") return { error: "Only managers can change the timetable." };
  const id = Number(form.get("id"));
  const row = await one<{ center_id: number }>(
    "SELECT center_id FROM timetable_slots WHERE id = $1", [id]);
  if (!row) return { error: "Slot not found." };
  if (user.role !== "super_admin" && row.center_id !== user.centerId)
    return { error: "That slot belongs to another centre." };

  await query("DELETE FROM timetable_slots WHERE id = $1", [id]);
  revalidatePath("/timetable");
  return { ok: "Slot removed." };
}
