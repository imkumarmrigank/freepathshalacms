"use server";
import { requireUser } from "@/lib/auth";
import { canScheduleVisits } from "@/lib/roles";
import { auditorDayDetail, staffNoteOn } from "@/lib/day-book";

/** One auditor's day, item by item, for the panel that opens on a row. */
export async function loadAuditorDay(day: string, personId: number, centerId: number | null) {
  const user = await requireUser();
  if (!canScheduleVisits(user.role)) return { error: "Not your day book." };
  const [items, note] = await Promise.all([
    auditorDayDetail(day, personId, centerId),
    staffNoteOn(day, personId),
  ]);
  return { items, note };
}
