"use server";
import { requireUser } from "@/lib/auth";
import { isGlobalRole } from "@/lib/roles";
import { sportsDayDetail } from "@/lib/day-book";

/** One sports teacher's day, item by item, for the panel that opens on a row. */
export async function loadSportsDay(day: string, personId: number, centerId: number | null) {
  const user = await requireUser();
  if (!isGlobalRole(user.role) || user.role === "sports_teacher")
    return { error: "Not your day book." };
  return { items: await sportsDayDetail(day, personId, centerId) };
}
