"use server";
import { revalidatePath } from "next/cache";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { FLAG_REASONS } from "@/lib/counselling-meta";
import { isTeaching } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/**
 * Anyone who works with the child may raise a referral — including the mentor.
 * A mentor who hears something at a PTM that needs picking up properly should
 * be able to put it on the list rather than keep it in their head; the record
 * says who raised it, so a mentor's own referral reads as exactly that.
 */
function canRaise(role: string) {
  return role !== "auditor";
}

/** Only the mentor — and the admins above them — work a referral. */
function canWork(role: string) {
  return role === "mentor" || role === "admin" || role === "super_admin";
}

export async function raiseFlag(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canRaise(user.role))
    return { error: "An auditor does not raise counselling referrals." };

  const studentId = Number(form.get("student_id"));
  const reasons = form.getAll("reason").map((v) => String(v))
    .filter((v) => (FLAG_REASONS as readonly string[]).includes(v));
  const note = str(form, "note");
  const urgency = String(form.get("urgency") ?? "normal") === "high" ? "high" : "normal";

  if (reasons.length === 0) return { error: "Pick at least one reason." };

  const student = await one<{ center_id: number; status: string }>(
    "SELECT center_id, status FROM students WHERE id = $1", [studentId]);
  if (!student) return { error: "Student not found." };
  if (!canTouchCenter(user, student.center_id))
    return { error: "That student is at another centre." };

  const open = await one<{ id: number }>(
    "SELECT id FROM counselling_flags WHERE student_id = $1 AND status <> 'closed'",
    [studentId]);
  if (open) return { error: "This child already has a referral waiting with the mentor." };

  const session = await currentSession();
  const enrolment = session
    ? await one<{ class_level_id: number }>(
        `SELECT class_level_id FROM enrollments
          WHERE student_id = $1 AND session_id = $2 ORDER BY id DESC LIMIT 1`,
        [studentId, session.id])
    : null;

  await query(
    `INSERT INTO counselling_flags
       (student_id, center_id, session_id, class_level_id, reasons, note, urgency, raised_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [studentId, student.center_id, session?.id ?? null, enrolment?.class_level_id ?? null,
     reasons, note, urgency, user.uid],
  );

  revalidatePath("/counselling");
  revalidatePath("/counselling/flagged");
  revalidatePath(`/students/${studentId}`);
  revalidatePath("/dashboard");
  return { ok: "Referred to the mentor." };
}

/**
 * The mentor's side of a referral: pick it up, write down what was done, and
 * in the end say how it went. Every save leaves a dated line of its own, so
 * the register shows the steps and not only the ending.
 */
export async function updateFlag(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canWork(user.role))
    return { error: "Only the mentor closes a counselling referral." };

  const id = Number(form.get("flag_id"));
  const status = String(form.get("status"));
  if (!["open", "in_progress", "closed"].includes(status))
    return { error: "Unknown status." };

  const flag = await one<{ center_id: number; student_id: number; status: string }>(
    "SELECT center_id, student_id, status FROM counselling_flags WHERE id = $1", [id]);
  if (!flag) return { error: "Referral not found." };
  if (!canTouchCenter(user, flag.center_id))
    return { error: "That referral is at another centre." };

  const outcome = str(form, "outcome");
  const note = str(form, "note");
  if (status === "closed" && !outcome)
    return { error: "Say what came of it before closing the referral." };
  if (status === "in_progress" && flag.status === "in_progress" && !note)
    return { error: "Write down what you did this time." };

  await query(
    `UPDATE counselling_flags
        SET status = $2, outcome = COALESCE($3, outcome), mentor_id = $4,
            picked_up_on = COALESCE(picked_up_on,
                                    CASE WHEN $2 <> 'open' THEN CURRENT_DATE END),
            closed_on = CASE WHEN $2 = 'closed' THEN CURRENT_DATE ELSE NULL END,
            updated_at = now()
      WHERE id = $1`,
    [id, status, outcome, user.uid],
  );

  // One line per save. Picking a child up and writing the first note is a
  // single step, so it is recorded once, as the pick-up.
  const kind = status === "closed" ? "closed"
    : status === "open" ? "reopened"
    : flag.status === "open" ? "picked_up" : "note";
  await query(
    `INSERT INTO counselling_actions (flag_id, kind, note, acted_by) VALUES ($1,$2,$3,$4)`,
    [id, kind, kind === "closed" ? outcome : note, user.uid],
  );

  revalidatePath("/counselling");
  revalidatePath("/counselling/flagged");
  revalidatePath(`/students/${flag.student_id}`);
  revalidatePath("/dashboard");
  return { ok: status === "closed" ? "Referral closed." : "Referral updated." };
}
