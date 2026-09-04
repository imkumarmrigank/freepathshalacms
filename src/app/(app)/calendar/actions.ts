"use server";
import { revalidatePath } from "next/cache";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { HOLIDAY_TYPES } from "@/lib/calendar-meta";
import { isGlobalRole, isTeaching } from "@/lib/roles";

/**
 * An event with no centre belongs to every centre, so only somebody who can
 * post to every centre may change or remove it. Reading a null as "somebody
 * else's centre" is what stopped anyone, super admin included, from deleting an
 * all-centres holiday.
 */
function mayTouchEvent(
  user: Awaited<ReturnType<typeof requireUser>>,
  centerId: number | null,
) {
  return centerId === null ? isGlobalRole(user.role) : canTouchCenter(user, centerId);
}

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};



export async function saveEvent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role))
    return { error: "Only centre managers and admins can change the calendar." };

  const id = form.get("id") ? Number(form.get("id")) : null;
  const title = str(form, "title");
  const startDate = str(form, "start_date");
  const endDate = str(form, "end_date") ?? startDate;
  const type = String(form.get("event_type") ?? "event");
  if (!title || !startDate) return { error: "Give the event a title and a date." };
  if (endDate! < startDate) return { error: "The end date cannot be before the start date." };

  // A manager can only publish to their own centre; only an admin can post to all centres.
  let centerId: number | null;
  if (user.role === "super_admin") {
    centerId = form.get("center_id") ? Number(form.get("center_id")) : null;
  } else if (user.role === "mentor") {
    centerId = form.get("center_id") ? Number(form.get("center_id")) : (user.centerIds[0] ?? null);
    // "all centres" is the administrator's to publish; a mentor names one of theirs
    if (!centerId || !canTouchCenter(user, centerId))
      return { error: "Choose one of the centres you cover." };
  } else {
    centerId = user.centerId;
  }

  const allDay = form.get("is_all_day") === "on";
  const session = await currentSession();

  if (id) {
    const existing = await one<{ center_id: number | null }>(
      "SELECT center_id FROM calendar_events WHERE id = $1", [id]);
    if (!existing) return { error: "Event not found." };
    if (!mayTouchEvent(user, existing.center_id))
      return {
        error: existing.center_id === null
          ? "This event is on every centre's calendar, so only an administrator can change it."
          : "That event belongs to another centre.",
      };

    await query(
      `UPDATE calendar_events SET title=$2, event_type=$3, center_id=$4, start_date=$5,
          end_date=$6, is_all_day=$7, start_time=$8, end_time=$9, description=$10,
          affects_attendance=$11
        WHERE id=$1`,
      [id, title, type, centerId, startDate, endDate, allDay,
       allDay ? null : str(form, "start_time"), allDay ? null : str(form, "end_time"),
       str(form, "description"), HOLIDAY_TYPES.has(type)],
    );
  } else {
    await query(
      `INSERT INTO calendar_events (title, event_type, center_id, session_id, start_date,
          end_date, is_all_day, start_time, end_time, description, affects_attendance, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [title, type, centerId, session?.id ?? null, startDate, endDate, allDay,
       allDay ? null : str(form, "start_time"), allDay ? null : str(form, "end_time"),
       str(form, "description"), HOLIDAY_TYPES.has(type), user.uid],
    );
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: id ? "Event updated." : "Event added to the calendar." };
}

export async function deleteEvent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role)) return { error: "Only managers and admins can do that." };
  const id = Number(form.get("id"));
  const existing = await one<{ center_id: number | null }>(
    "SELECT center_id FROM calendar_events WHERE id = $1", [id]);
  if (!existing) return { error: "Event not found." };
  if (!mayTouchEvent(user, existing.center_id))
    return {
      error: existing.center_id === null
        ? "This event is on every centre's calendar, so only an administrator can remove it. "
          + "To keep just your centre open, use “this centre is working” instead."
        : "That event belongs to another centre.",
    };

  await query("DELETE FROM calendar_events WHERE id = $1", [id]);
  revalidatePath("/calendar");
  return { ok: "Event removed." };
}


/**
 * Keeps one centre working through a holiday that covers all of them. The event
 * stays where it is for everybody else — far better than deleting a holiday
 * eleven centres are observing because the twelfth is not.
 */
export async function openCentreOnHoliday(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role))
    return { error: "Only centre managers and admins can change the calendar." };

  const eventId = Number(form.get("event_id"));
  const centerId = Number(form.get("center_id"));
  if (!eventId || !centerId) return { error: "Pick a centre." };
  if (!canTouchCenter(user, centerId))
    return { error: "That centre is not one of yours." };

  const event = await one<{ center_id: number | null; affects_attendance: boolean }>(
    "SELECT center_id, affects_attendance FROM calendar_events WHERE id = $1", [eventId]);
  if (!event) return { error: "Event not found." };
  if (event.center_id !== null)
    return { error: "That holiday is already set for one centre — remove it instead." };

  await query(
    `INSERT INTO calendar_event_exceptions (event_id, center_id, reason, created_by)
     VALUES ($1,$2,$3,$4) ON CONFLICT (event_id, center_id) DO NOTHING`,
    [eventId, centerId, str(form, "reason"), user.uid]);

  revalidatePath("/calendar");
  revalidatePath("/attendance");
  return { ok: "That centre will be working." };
}

/** Puts a centre back on the holiday. */
export async function closeCentreOnHoliday(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role))
    return { error: "Only centre managers and admins can change the calendar." };

  const eventId = Number(form.get("event_id"));
  const centerId = Number(form.get("center_id"));
  if (!canTouchCenter(user, centerId))
    return { error: "That centre is not one of yours." };

  await query(
    "DELETE FROM calendar_event_exceptions WHERE event_id = $1 AND center_id = $2",
    [eventId, centerId]);

  revalidatePath("/calendar");
  revalidatePath("/attendance");
  return { ok: "That centre is on holiday again." };
}
