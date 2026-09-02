/**
 * Staff check-in has to prove presence at the centre, so the circle is small.
 * The 20 m floor is deliberate: a phone reports its position to about ±10–20 m,
 * and a tighter fence would start refusing people who are genuinely standing there.
 */
export const GEOFENCE_MIN_M = 20;
export const GEOFENCE_MAX_M = 50;
export const GEOFENCE_DEFAULT_M = 50;

/** Great-circle distance in metres between two WGS-84 points. */
export function haversineMeters(
  lat1: number, lng1: number, lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export type GeoCheck = {
  ok: boolean;
  distance: number;
  radius: number;
  reason?: string;
  /** True when the gap is so large the centre's saved pin is the likely fault. */
  pinLooksWrong?: boolean;
};

/** Past this, "you are too far" is almost certainly a bad pin, not a distant member of staff. */
const PIN_SUSPECT_M = 2000;

function readable(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

/** Is the punch inside the centre's geofence? */
export function checkGeofence(
  center: { latitude: number | null; longitude: number | null; geofence_radius_m: number },
  lat: number,
  lng: number,
): GeoCheck {
  if (center.latitude == null || center.longitude == null) {
    return { ok: false, distance: -1, radius: center.geofence_radius_m,
      reason: "This centre has no location set. Ask your admin to pin the centre on the map." };
  }
  const distance = haversineMeters(center.latitude, center.longitude, lat, lng);
  const radius = center.geofence_radius_m ?? GEOFENCE_DEFAULT_M;
  if (distance <= radius) return { ok: true, distance, radius };

  // A few hundred metres is someone standing down the road. A thousand times that
  // is the centre's own coordinates being wrong, and the message should say so.
  if (distance > PIN_SUSPECT_M) {
    return {
      ok: false, distance, radius, pinLooksWrong: true,
      reason: `This centre’s saved location looks wrong — it places you ${readable(distance)} away. ` +
              "Ask your administrator to stand at the centre and re-pin it.",
    };
  }
  return {
    ok: false, distance, radius,
    reason: `You are ${readable(distance)} from the centre. Check-in is only possible ` +
            `within ${radius} m, so move closer and try again.`,
  };
}
