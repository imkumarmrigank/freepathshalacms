"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { WEEK_OFF_KEY, formatWeekOff, describeWeekOff } from "@/lib/week";

/**
 * Sets the days of the week the centres are closed. Nothing rewrites attendance
 * that has already been taken — this only changes which days the register
 * closes itself on from here on, and how the calendar draws the week.
 */
export async function saveWorkingDays(_prev: unknown, form: FormData) {
  await requireRole("super_admin");

  // the form posts the days that ARE worked; everything else is a day off
  const worked = new Set(form.getAll("working_day").map((v) => Number(v)));
  const off = [0, 1, 2, 3, 4, 5, 6].filter((d) => !worked.has(d));

  if (worked.size === 0) return { error: "Keep at least one working day in the week." };

  await query(
    `INSERT INTO app_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [WEEK_OFF_KEY, formatWeekOff(off)],
  );

  revalidatePath("/manage/working-days");
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  return { ok: `Saved — ${describeWeekOff(off).toLowerCase()}.` };
}
