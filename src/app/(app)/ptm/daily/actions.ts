"use server";
import { requireUser } from "@/lib/auth";
import { isGlobalRole } from "@/lib/roles";
import { mentorDayDetail, staffNoteOn } from "@/lib/day-book";

/** One mentor's day, item by item, for the panel that opens on a row. */
export async function loadMentorDay(day: string, personId: number, centerId: number | null) {
  const user = await requireUser();
  if (!isGlobalRole(user.role) && user.role !== "center_manager")
    return { error: "Not your day book." };
  // a centre manager reads their own centre's mentors, nobody else's
  const scope = isGlobalRole(user.role) ? centerId : user.centerId;
  const [items, note] = await Promise.all([
    mentorDayDetail(day, personId, scope),
    staffNoteOn(day, personId),
  ]);
  return { items, note };
}
