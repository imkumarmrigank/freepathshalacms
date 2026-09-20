"use server";
import { revalidatePath } from "next/cache";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { tx } from "@/lib/db";
import { SAME_DAY_ONLY } from "@/lib/attendance";
import { today } from "@/lib/format";
import { canMarkAttendance } from "@/lib/roles";
import { isReasonFor, needsReason, reasonRequiredOn } from "@/lib/attendance-meta";

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
  if (!canMarkAttendance(user.role))
    return { error: "You can read the register but not mark it." };
  if (!canTouchCenter(user, centerId))
    return { error: "You can only mark attendance for your own centre." };

  const entries: { enrollmentId: number; status: string; reason: string | null }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("st_")) continue;
    const enrollmentId = Number(key.slice(3));
    const status = String(value);
    if (!enrollmentId || !VALID.has(status)) continue;
    const given = String(form.get(`rs_${enrollmentId}`) ?? "").trim() || null;
    // a reason only belongs to absent and leave; anything else clears it
    const reason = needsReason(status) ? given : null;
    if (reason !== null && !isReasonFor(status, reason))
      return { error: "One of the reasons does not fit the mark it was given with." };
    entries.push({ enrollmentId, status, reason });
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

      // What is already recorded for this day. A reason is required whenever a
      // teacher marks someone absent or on leave — but not for a record left as
      // it was: the register closes unmarked days as leave by itself, and the
      // imported months carry no reasons, and re-saving the sheet must not
      // demand a reason for every one of those.
      const { rows: before } = await c.query<{ student_id: number; status: string; reason: string | null }>(
        `SELECT student_id, status, reason FROM student_attendance
          WHERE att_date = $1 AND student_id = ANY($2::bigint[])`,
        [attDate, rows.map((r) => r.student_id)],
      );
      const was = new Map(before.map((b) => [b.student_id, b]));

      // Being present is a same-day judgement: a day that went unmarked is
      // closed as absent and cannot be turned into attendance afterwards. A
      // mark the register already holds is not a new judgement, so re-saving a
      // sheet that carries older marks is allowed to go through untouched.
      if (isPast) {
        for (const e of entries) {
          if (!SAME_DAY_ONLY.has(e.status)) continue;
          const enr = byId.get(e.enrollmentId);
          const prior = enr ? was.get(enr.student_id) : null;
          if (prior?.status === e.status) continue;
          throw new Error(
            "Attendance for a past date cannot be marked present. " +
            "A closed day can only be corrected to absent.");
        }
      }

      let missing = 0;
      // a reason may still be given for an earlier day, but is only demanded from
      // the date the rule came in
      for (const e of reasonRequiredOn(attDate) ? entries : []) {
        const enr = byId.get(e.enrollmentId);
        if (!enr || !needsReason(e.status) || e.reason) continue;
        const prior = was.get(enr.student_id);
        const unchanged = prior && prior.status === e.status && !prior.reason;
        if (!unchanged) missing++;
      }
      if (missing > 0) {
        throw new Error(
          `Choose a reason for ${missing} student${missing === 1 ? "" : "s"} marked absent or on leave.`);
      }

      for (const e of entries) {
        const enr = byId.get(e.enrollmentId);
        if (!enr || enr.center_id !== centerId) continue;  // ignore anything out of scope
        await c.query(
          `INSERT INTO student_attendance
             (student_id, enrollment_id, session_id, class_level_id, center_id,
              att_date, status, reason, marked_by, marked_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
           ON CONFLICT (student_id, att_date) DO UPDATE
             SET status = EXCLUDED.status,
                 -- keep an existing reason when the mark is re-saved unchanged
                 -- without one; otherwise take what was chosen
                 reason = CASE
                   WHEN EXCLUDED.reason IS NULL AND student_attendance.status = EXCLUDED.status
                     THEN student_attendance.reason
                   ELSE EXCLUDED.reason END,
                 marked_by = EXCLUDED.marked_by,
                 marked_at = now(), enrollment_id = EXCLUDED.enrollment_id,
                 class_level_id = EXCLUDED.class_level_id`,
          [enr.student_id, enr.id, sessionId, classLevelId, centerId, attDate, e.status,
           e.reason, user.uid],
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
