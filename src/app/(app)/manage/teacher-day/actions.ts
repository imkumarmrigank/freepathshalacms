"use server";
import { requireRole } from "@/lib/auth";
import { teacherDayDetail } from "@/lib/day-book";

/** One teacher's day in full, for the panel that opens on a row. */
export async function loadTeacherDay(day: string, personId: number) {
  await requireRole("super_admin", "admin", "center_manager");
  return teacherDayDetail(day, personId);
}
