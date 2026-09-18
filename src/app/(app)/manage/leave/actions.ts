"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { canDecideLeave } from "@/lib/roles";

type Result = { error?: string; ok?: string };

/**
 * Approve or refuse a request. Approving writes the days into the staff
 * register as leave, so the centre's attendance stops counting the person as
 * simply missing — but never over a day they actually checked in on, and never
 * over a declared holiday.
 */
export async function decideLeave(_prev: unknown, form: FormData): Promise<Result> {
  const actor = await requireUser();
  if (!canDecideLeave(actor.role))
    return { error: "Only an admin or super admin answers leave." };

  const id = Number(form.get("id"));
  const decision = String(form.get("decision"));
  const note = String(form.get("note") ?? "").trim() || null;
  if (decision !== "approved" && decision !== "rejected")
    return { error: "Approve it or refuse it." };

  const row = await one<{
    status: string; user_id: number; center_id: number | null;
    starts_on: string; ends_on: string; staff_name: string;
  }>(
    `SELECT r.status, r.user_id, COALESCE(r.center_id, u.center_id) AS center_id,
            r.starts_on, r.ends_on, u.name AS staff_name
       FROM staff_leave_requests r JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [id],
  );
  if (!row) return { error: "That request could not be found." };
  if (row.status === "cancelled") return { error: "That request was withdrawn." };

  await tx(async (c) => {
    await c.query(
      `UPDATE staff_leave_requests
          SET status = $2, decided_by = $3, decided_at = now(), decision_note = $4
        WHERE id = $1`,
      [id, decision, actor.uid, note],
    );

    if (decision === "approved" && row.center_id) {
      await c.query(
        `INSERT INTO staff_attendance (user_id, center_id, att_date, status, within_geofence)
         SELECT $1, $2, d::date, 'leave', TRUE
           FROM generate_series($3::date, $4::date, interval '1 day') d
         ON CONFLICT (user_id, att_date) DO UPDATE
           SET status = CASE
                 WHEN staff_attendance.check_in_at IS NULL
                  AND staff_attendance.status <> 'holiday' THEN 'leave'
                 ELSE staff_attendance.status END`,
        [row.user_id, row.center_id, row.starts_on, row.ends_on],
      );
    }

    // A decision reversed after the fact must not leave the register claiming
    // leave that was refused — but only days nobody worked are taken back.
    if (decision === "rejected" && row.status === "approved") {
      await c.query(
        `DELETE FROM staff_attendance
          WHERE user_id = $1 AND att_date BETWEEN $2 AND $3
            AND status = 'leave' AND check_in_at IS NULL`,
        [row.user_id, row.starts_on, row.ends_on],
      );
    }
  });

  revalidatePath("/manage/leave");
  revalidatePath("/leave");
  revalidatePath("/manage/staff-attendance");
  return {
    ok: decision === "approved"
      ? `${row.staff_name}'s leave approved.`
      : `${row.staff_name}'s leave refused.`,
  };
}
