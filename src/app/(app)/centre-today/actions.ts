"use server";
import { requireUser } from "@/lib/auth";
import { centreDay } from "@/lib/centre-today";

/** One centre's day, person by person, for the panel a card opens. */
export async function loadCentreDay(centerId: number, on: string) {
  const user = await requireUser();
  if (user.role !== "super_admin" && user.role !== "admin")
    return { error: "That is not yours to read." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { error: "That is not a day." };
  return centreDay(centerId, on);
}
