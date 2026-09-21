"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { checkGeofence } from "@/lib/geo";
import { today } from "@/lib/format";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function location(form: FormData) {
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const accuracy = form.get("accuracy") ? Math.round(Number(form.get("accuracy"))) : null;
  const ok = form.get("lat") !== null && form.get("lat") !== ""
    && Number.isFinite(lat) && Number.isFinite(lng);
  return { ok, lat, lng, accuracy };
}

async function centre(id: number) {
  return one<{
    id: number; name: string; latitude: number | null; longitude: number | null;
    geofence_radius_m: number;
  }>("SELECT id, name, latitude, longitude, geofence_radius_m FROM centers WHERE id = $1 AND is_active",
    [id]);
}

/**
 * Arriving at a centre. The same geofence as a teacher's check-in: the sports
 * teacher has to be standing at the centre, and has to finish one centre —
 * report and all — before starting the next.
 */
export async function startVisit(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  if (user.role !== "sports_teacher")
    return { error: "Only the sports teacher checks in for a sports visit." };

  const c = await centre(Number(form.get("center_id")));
  if (!c) return { error: "That centre could not be found." };

  const open = await one<{ center_name: string }>(
    `SELECT c.name AS center_name FROM sports_visits v JOIN centers c ON c.id = v.center_id
      WHERE v.user_id = $1 AND v.report_submitted_at IS NULL`, [user.uid]);
  if (open)
    return { error: `You are still checked in at ${open.center_name}. Submit that visit's report first.` };

  const loc = location(form);
  if (!loc.ok) return { error: "Location unavailable. Allow location access and try again." };
  const geo = checkGeofence(c, loc.lat, loc.lng, "in");
  if (!geo.ok) return { error: geo.reason ?? "You are outside the centre's allowed area." };

  try {
    await query(
      `INSERT INTO sports_visits
         (user_id, center_id, visit_date, check_in_lat, check_in_lng,
          check_in_distance_m, check_in_accuracy_m)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user.uid, c.id, today(), loc.lat, loc.lng, geo.distance, loc.accuracy]);
  } catch {
    // two taps at once: the one-open-visit index turned the second away
    return { error: "You are already checked in somewhere. Refresh the page." };
  }
  revalidatePath("/sports");
  return { ok: `Checked in at ${c.name} — ${geo.distance} m from the centre.` };
}

/**
 * Leaving, with the account of the visit. Leaving is checked at the centre the
 * same way arriving was. A visit left open from an earlier day can still be
 * reported, but it records no departure — nobody can say when that was.
 */
export async function finishVisit(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const visit = await one<{ id: number; center_id: number; visit_date: string }>(
    `SELECT id, center_id, visit_date FROM sports_visits
      WHERE id = $1 AND user_id = $2 AND report_submitted_at IS NULL`,
    [Number(form.get("visit_id")), user.uid]);
  if (!visit) return { error: "That visit is already closed." };

  const activities = str(form, "activities");
  if (!activities || activities.length < 10)
    return { error: "Say what you did at the centre today — a line or two is enough." };
  const countRaw = str(form, "children_count");
  const children = countRaw === null ? null : Number(countRaw);
  if (children !== null && (!Number.isInteger(children) || children < 0 || children > 1000))
    return { error: "Give the number of children who took part." };
  const sports = form.getAll("sports_covered").map(String).filter(Boolean).slice(0, 20);

  const lateClose = visit.visit_date < today();
  let checkout: { lat: number; lng: number; distance: number } | null = null;
  if (!lateClose) {
    const c = await centre(visit.center_id);
    const loc = location(form);
    if (!c) return { error: "That centre could not be found." };
    if (!loc.ok) return { error: "Location unavailable. Allow location access and try again." };
    const geo = checkGeofence(c, loc.lat, loc.lng, "out");
    if (!geo.ok) return { error: geo.reason ?? "Check out from the centre itself." };
    checkout = { lat: loc.lat, lng: loc.lng, distance: geo.distance };
  }

  await query(
    `UPDATE sports_visits
        SET sports_covered = $2, children_count = $3, activities = $4,
            highlights = $5, issues = $6, report_submitted_at = now(),
            closed_late = $7,
            check_out_at = CASE WHEN $7 THEN NULL ELSE now() END,
            check_out_lat = $8, check_out_lng = $9, check_out_distance_m = $10,
            worked_minutes = CASE WHEN $7 THEN NULL
              ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - check_in_at)) / 60)::int) END
      WHERE id = $1`,
    [visit.id, sports, children, activities, str(form, "highlights"), str(form, "issues"),
     lateClose, checkout?.lat ?? null, checkout?.lng ?? null, checkout?.distance ?? null]);

  revalidatePath("/sports");
  return {
    ok: lateClose
      ? "Report submitted for that earlier visit."
      : "Report submitted and checked out. On to the next centre.",
  };
}
