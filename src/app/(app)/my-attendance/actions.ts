"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { checkGeofence } from "@/lib/geo";
import { today } from "@/lib/format";

type Punch = { error?: string; ok?: string };

/** Late if the teacher checks in after this hour:minute (centre-agnostic for now). */
const LATE_AFTER_MINUTES = 10 * 60 + 15; // 10:15 local

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

  const geo = checkGeofence(center, lat, lng);
  if (!geo.ok) return { error: geo.reason ?? "You are outside the centre's allowed area." };

  const day = today();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (kind === "in") {
    const existing = await one<{ check_in_at: string | null }>(
      "SELECT check_in_at FROM staff_attendance WHERE user_id = $1 AND att_date = $2",
      [user.uid, day],
    );
    if (existing?.check_in_at) return { error: "You have already checked in today." };

    await query(
      `INSERT INTO staff_attendance
         (user_id, center_id, att_date, check_in_at, check_in_lat, check_in_lng,
          check_in_distance_m, check_in_accuracy_m, status, within_geofence)
       VALUES ($1,$2,$3, now(), $4,$5,$6,$7,$8, TRUE)
       ON CONFLICT (user_id, att_date) DO UPDATE
         SET check_in_at = now(), check_in_lat = EXCLUDED.check_in_lat,
             check_in_lng = EXCLUDED.check_in_lng,
             check_in_distance_m = EXCLUDED.check_in_distance_m,
             check_in_accuracy_m = EXCLUDED.check_in_accuracy_m,
             status = EXCLUDED.status, within_geofence = TRUE`,
      [user.uid, center.id, day, lat, lng, geo.distance, accuracy,
       minutes > LATE_AFTER_MINUTES ? "late" : "present"],
    );
    revalidatePath("/my-attendance");
    return { ok: `Checked in at ${center.name} — ${geo.distance} m from the centre.` };
  }

  const row = await one<{ id: number; check_in_at: string | null; check_out_at: string | null }>(
    "SELECT id, check_in_at, check_out_at FROM staff_attendance WHERE user_id = $1 AND att_date = $2",
    [user.uid, day],
  );
  if (!row?.check_in_at) return { error: "Check in first." };
  if (row.check_out_at) return { error: "You have already checked out today." };

  await query(
    `UPDATE staff_attendance
        SET check_out_at = now(), check_out_lat = $2, check_out_lng = $3,
            check_out_distance_m = $4,
            worked_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - check_in_at)) / 60)::int)
      WHERE id = $1`,
    [row.id, lat, lng, geo.distance],
  );
  revalidatePath("/my-attendance");
  return { ok: "Checked out. Have a good day!" };
}
