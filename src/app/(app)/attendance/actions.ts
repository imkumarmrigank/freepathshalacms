"use server";
import { revalidatePath } from "next/cache";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { tx } from "@/lib/db";
import { SAME_DAY_ONLY } from "@/lib/attendance";
import { today } from "@/lib/format";
import { isGlobalRole } from "@/lib/roles";

const VALID = new Set(["present", "absent", "late", "half_day", "leave", "holiday"]);

/**
 * Upserts one day's attendance for a whole class.
 * Payload arrives as `st_<enrollmentId>` -> status, so re-marking a day
 * simply overwrites the previous entry (unique on student + date).
 */
export async function saveAttendance(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const attDate = String(form.get("att_date") ?? "");
  const sessionId = Number(form.get("session_id"));
  const classLevelId = Number(form.get("class_level_id"));
  const centerId = Number(form.get("center_id"));

  if (!attDate || !sessionId || !classLevelId || !centerId)
    return { error: "Pick a centre, class and date first." };
  const isPast = attDate < today();
  if (attDate > today())
    return { error: "You cannot mark attendance for a future date." };
  if (!canTouchCenter(user, centerId))
    return { error: "You can only mark attendance for your own centre." };

  const entries: { enrollmentId: number; status: string }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("st_")) continue;
    const enrollmentId = Number(key.slice(3));
    const status = String(value);
    if (!enrollmentId || !VALID.has(status)) continue;
    // Present / late / half-day are a same-day judgement; a day that went unmarked
    // is closed as leave and can only be corrected to absent or leave afterwards.
    if (isPast && SAME_DAY_ONLY.has(status))
      return {
        error: "Attendance for a past date cannot be marked present, late or half day. " +
               "Those days can only be recorded as leave or absent.",
      };
    entries.push({ enrollmentId, status });
  }
  if (entries.length === 0) return { error: "Nothing to save." };

  let saved = 0;
  try {
    await tx(async (c) => {
      const ids = entries.map((e) => e.enrollmentId);
      const { rows } = await c.query<{ id: number; student_id: number; center_id: number }>(
        `SELECT id, student_id, center_id FROM enrollments
          WHERE id = ANY($1::bigint[]) AND session_id = $2 AND class_level_id = $3`,
        [ids, sessionId, classLevelId],
      );
      const byId = new Map(rows.map((r) => [r.id, r]));

      for (const e of entries) {
        const enr = byId.get(e.enrollmentId);
        if (!enr || enr.center_id !== centerId) continue;  // ignore anything out of scope
        await c.query(
          `INSERT INTO student_attendance
             (student_id, enrollment_id, session_id, class_level_id, center_id,
              att_date, status, marked_by, marked_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
           ON CONFLICT (student_id, att_date) DO UPDATE
             SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by,
                 marked_at = now(), enrollment_id = EXCLUDED.enrollment_id,
                 class_level_id = EXCLUDED.class_level_id`,
          [enr.student_id, enr.id, sessionId, classLevelId, centerId, attDate, e.status, user.uid],
        );
        saved++;
      }
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save attendance." };
  }

  if (saved === 0) return { error: "Nothing was saved — the roster no longer matches this class." };

  revalidatePath("/attendance");
  return { ok: `Attendance saved for ${saved} student${saved === 1 ? "" : "s"}.` };
}
