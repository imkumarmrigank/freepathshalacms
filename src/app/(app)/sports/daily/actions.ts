"use server";
import { requireUser } from "@/lib/auth";
import { isGlobalRole } from "@/lib/roles";
import { sportsDayDetail, staffNoteOn } from "@/lib/day-book";

/** One sports teacher's day, item by item, for the panel that opens on a row. */
export async function loadSportsDay(day: string, personId: number, centerId: number | null) {
  const user = await requireUser();
  if (!isGlobalRole(user.role) || user.role === "sports_teacher")
    return { error: "Not your day book." };
  const [items, note] = await Promise.all([
    sportsDayDetail(day, personId, centerId),
    staffNoteOn(day, personId),
  ]);
  return { items, note };
}
