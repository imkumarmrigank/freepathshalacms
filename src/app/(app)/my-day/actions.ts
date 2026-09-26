"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { today } from "@/lib/format";
import { isTeaching } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/**
 * The teacher's own account of the day. Saved as one note per class, edited
 * freely while the day is open and left alone afterwards: a lesson written up
 * a week later is not the same record, and the date it belongs to is the date
 * it is filed under.
 */
export async function saveDayNote(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!isTeaching(user.role) && user.role !== "center_manager")
    return { error: "This day book belongs to the teaching staff." };

  const onDate = String(form.get("on_date") ?? today()).slice(0, 10);
  if (onDate > today()) return { error: "You cannot write up a day that has not happened." };

  const classId = Number(form.get("class_level_id")) || null;
  const chapter = str(form, "chapter");
  const homework = str(form, "homework");
  const other = str(form, "other_work");
  const extra = str(form, "extra_activity");
  if (!chapter && !homework && !other && !extra)
    return { error: "Write at least what you taught, what you set, or what else you did." };

  const session = await currentSession();
  await query(
    `INSERT INTO teacher_day_notes
       (user_id, center_id, class_level_id, session_id, on_date, subject, chapter,
        chapter_detail, homework, homework_detail, equipment, equipment_result,
        other_work, support_needed, extra_activity, extra_detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (user_id, on_date, COALESCE(class_level_id, 0)) DO UPDATE
       SET subject = EXCLUDED.subject, chapter = EXCLUDED.chapter,
           chapter_detail = EXCLUDED.chapter_detail, homework = EXCLUDED.homework,
           homework_detail = EXCLUDED.homework_detail, equipment = EXCLUDED.equipment,
           equipment_result = EXCLUDED.equipment_result, other_work = EXCLUDED.other_work,
           support_needed = EXCLUDED.support_needed,
           extra_activity = EXCLUDED.extra_activity,
           extra_detail = EXCLUDED.extra_detail, updated_at = now()`,
    [user.uid, user.centerId, classId, session?.id ?? null, onDate,
     str(form, "subject"), chapter, str(form, "chapter_detail"),
     homework, str(form, "homework_detail"), str(form, "equipment"),
     str(form, "equipment_result"), other, str(form, "support_needed"),
     str(form, "extra_activity"), str(form, "extra_detail")],
  );

  revalidatePath("/my-day");
  return { ok: "Saved. Your centre manager can read it." };
}

/** Taking back a note written against the wrong class or the wrong day. */
export async function deleteDayNote(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const note = await one<{ user_id: number; on_date: string }>(
    "SELECT user_id, on_date FROM teacher_day_notes WHERE id = $1", [id]);
  if (!note || note.user_id !== user.uid) return { error: "That note is not yours." };
  await query("DELETE FROM teacher_day_notes WHERE id = $1", [id]);
  revalidatePath("/my-day");
  return { ok: "Note removed." };
}
