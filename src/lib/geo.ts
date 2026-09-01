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
};

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
  const radius = center.geofence_radius_m ?? 150;
  return distance <= radius
    ? { ok: true, distance, radius }
    : { ok: false, distance, radius,
        reason: `You are ${distance} m from the centre (allowed ${radius} m).` };
}
