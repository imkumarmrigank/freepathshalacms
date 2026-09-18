"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { can } from "@/lib/roles";
import { isLeaveType, leaveDays } from "@/lib/leave-meta";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A member of staff asks for time off. Nothing is decided here. */
export async function applyForLeave(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  if (!can(user.role, "leave")) return { error: "Your role does not apply for leave here." };

  const type = str(form, "leave_type");
  const startsOn = str(form, "starts_on");
  const endsOn = str(form, "ends_on") || startsOn;
  const reason = str(form, "reason");
  const halfDay = form.get("half_day") === "on";

  if (!isLeaveType(type)) return { error: "Choose the kind of leave." };
  if (!startsOn) return { error: "Give the first day of leave." };
  if (endsOn < startsOn) return { error: "The last day cannot be before the first." };
  if (reason.length < 4) return { error: "Say why you need the leave — a few words is enough." };
  if (leaveDays(startsOn, endsOn) > 60)
    return { error: "That is longer than two months. Ask the office directly." };
  if (halfDay && endsOn !== startsOn)
    return { error: "A half day is one day only." };

  // Two requests covering the same day would leave the office answering both.
  const clash = await one<{ starts_on: string; ends_on: string }>(
    `SELECT starts_on, ends_on FROM staff_leave_requests
      WHERE user_id = $1 AND status IN ('pending','approved')
        AND starts_on <= $3 AND ends_on >= $2
      LIMIT 1`,
    [user.uid, startsOn, endsOn],
  );
  if (clash)
    return { error: `You already have a request covering ${clash.starts_on} to ${clash.ends_on}.` };

  await query(
    `INSERT INTO staff_leave_requests
       (user_id, center_id, leave_type, starts_on, ends_on, half_day, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [user.uid, user.centerId ?? null, type, startsOn, endsOn, halfDay, reason],
  );

  revalidatePath("/leave");
  revalidatePath("/manage/leave");
  return {
    ok: startsOn === endsOn
      ? `Leave requested for ${startsOn}. The office will answer it.`
      : `Leave requested from ${startsOn} to ${endsOn}. The office will answer it.`,
  };
}

/** Withdraw a request the office has not answered yet. */
export async function withdrawLeave(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const id = Number(form.get("id"));
  const row = await one<{ status: string }>(
    "SELECT status FROM staff_leave_requests WHERE id = $1 AND user_id = $2",
    [id, user.uid],
  );
  if (!row) return { error: "That request could not be found." };
  if (row.status !== "pending")
    return { error: "Only a request still awaiting approval can be withdrawn." };

  await query(
    "UPDATE staff_leave_requests SET status = 'cancelled' WHERE id = $1 AND user_id = $2",
    [id, user.uid],
  );
  revalidatePath("/leave");
  revalidatePath("/manage/leave");
  return { ok: "Request withdrawn." };
}
