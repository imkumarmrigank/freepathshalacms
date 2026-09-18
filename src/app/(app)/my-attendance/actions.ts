"use server";
import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { requireUser } from "@/lib/auth";
import { one, tx } from "@/lib/db";
import { checkGeofence } from "@/lib/geo";
import { today } from "@/lib/format";

type Punch = { error?: string; ok?: string };

/** Late if the teacher checks in after this hour:minute (centre-agnostic for now). */
const LATE_AFTER_MINUTES = 10 * 60 + 15; // 10:15 local

/**
 * The day's summary is derived, never typed: first arrival, last departure and
 * the minutes actually spent at the centre across every spell. Reports read
 * these columns, so they are rewritten after each punch.
 */
async function rollUpDay(c: PoolClient, attendanceId: number) {
  await c.query(
    `WITH spells AS (
       SELECT * FROM staff_punches WHERE attendance_id = $1
     ),
     arrival AS (SELECT * FROM spells ORDER BY check_in_at ASC LIMIT 1),
     departure AS (
       SELECT * FROM spells WHERE check_out_at IS NOT NULL
        ORDER BY check_out_at DESC LIMIT 1
     ),
     total AS (SELECT sum(worked_minutes) AS minutes FROM spells)
     UPDATE staff_attendance a
        SET check_in_at          = f.check_in_at,
            check_in_lat         = f.check_in_lat,
            check_in_lng         = f.check_in_lng,
            check_in_distance_m  = f.check_in_distance_m,
            check_in_accuracy_m  = f.check_in_accuracy_m,
            check_out_at         = l.check_out_at,
            check_out_lat        = l.check_out_lat,
            check_out_lng        = l.check_out_lng,
            check_out_distance_m = l.check_out_distance_m,
            worked_minutes       = t.minutes
       FROM arrival f, total t LEFT JOIN departure l ON TRUE
      WHERE a.id = $1`,
    [attendanceId],
  );
}

export async function punch(_prev: unknown, form: FormData): Promise<Punch> {
  const user = await requireUser();
  if (!user.centerId) return { error: "You are not assigned to a centre." };

  const kind = String(form.get("kind"));           // "in" | "out"
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const accuracy = form.get("accuracy") ? Math.round(Number(form.get("accuracy"))) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return { error: "Location unavailable. Allow location access and try again." };

  const center = await one<{
    id: number; name: string; latitude: number | null; longitude: number | null;
    geofence_radius_m: number;
  }>(
    "SELECT id, name, latitude, longitude, geofence_radius_m FROM centers WHERE id = $1",
    [user.centerId],
  );
  if (!center) return { error: "Your centre could not be found." };

  // Checking out is verified the same way as checking in — both must happen at the centre.
  const geo = checkGeofence(center, lat, lng, kind === "out" ? "out" : "in");
  if (!geo.ok) return { error: geo.reason ?? "You are outside the centre's allowed area." };

  const day = today();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  const result = await tx<Punch>(async (c) => {
    if (kind === "in") {
      // The day row is created on the first arrival and reused after that; the
      // late/on-time verdict belongs to that first arrival alone.
      const { rows: att } = await c.query<{ id: number }>(
        `INSERT INTO staff_attendance
           (user_id, center_id, att_date, status, within_geofence)
         VALUES ($1,$2,$3,$4, TRUE)
         ON CONFLICT (user_id, att_date) DO UPDATE
           SET center_id = EXCLUDED.center_id,
               status = CASE WHEN staff_attendance.check_in_at IS NULL
                             THEN EXCLUDED.status ELSE staff_attendance.status END
         RETURNING id`,
        [user.uid, center.id, day, minutes > LATE_AFTER_MINUTES ? "late" : "present"],
      );
      const attendanceId = att[0].id;

      const { rows: open } = await c.query(
        `SELECT 1 FROM staff_punches
          WHERE user_id = $1 AND att_date = $2 AND check_out_at IS NULL
          FOR UPDATE`,
        [user.uid, day],
      );
      if (open.length) return { error: "You are already checked in. Check out before checking in again." };

      await c.query(
        `INSERT INTO staff_punches
           (attendance_id, user_id, att_date, check_in_at, check_in_lat, check_in_lng,
            check_in_distance_m, check_in_accuracy_m)
         VALUES ($1,$2,$3, now(), $4,$5,$6,$7)`,
        [attendanceId, user.uid, day, lat, lng, geo.distance, accuracy],
      );
      await rollUpDay(c, attendanceId);
      return { ok: `Checked in at ${center.name} — ${geo.distance} m from the centre.` };
    }

    const { rows: spell } = await c.query<{ id: number; attendance_id: number }>(
      `SELECT id, attendance_id FROM staff_punches
        WHERE user_id = $1 AND att_date = $2 AND check_out_at IS NULL
        ORDER BY check_in_at DESC LIMIT 1
        FOR UPDATE`,
      [user.uid, day],
    );
    if (!spell.length) {
      const { rows: earlier } = await c.query(
        "SELECT 1 FROM staff_punches WHERE user_id = $1 AND att_date = $2",
        [user.uid, day],
      );
      return {
        error: earlier.length
          ? "You are already checked out. Check in again if you are back at the centre."
          : "Check in first.",
      };
    }

    await c.query(
      `UPDATE staff_punches
          SET check_out_at = now(), check_out_lat = $2, check_out_lng = $3,
              check_out_distance_m = $4, check_out_accuracy_m = $5,
              worked_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - check_in_at)) / 60)::int)
        WHERE id = $1`,
      [spell[0].id, lat, lng, geo.distance, accuracy],
    );
    await rollUpDay(c, spell[0].attendance_id);
    return { ok: "Checked out. Check in again if you come back today." };
  });

  if (result.ok) revalidatePath("/my-attendance");
  return result;
}
