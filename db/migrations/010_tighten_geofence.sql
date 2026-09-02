-- Staff check-in must prove someone is actually at the centre, so the geofence
-- is capped at 50 m. The floor is 20 m: a phone's own GPS reading is usually
-- accurate to ±10–20 m, and a tighter circle would refuse people who are there.

UPDATE centers SET geofence_radius_m = 50 WHERE geofence_radius_m > 50;
UPDATE centers SET geofence_radius_m = 20 WHERE geofence_radius_m < 20;

ALTER TABLE centers ALTER COLUMN geofence_radius_m SET DEFAULT 50;

ALTER TABLE centers DROP CONSTRAINT IF EXISTS centers_geofence_radius_range;
ALTER TABLE centers ADD CONSTRAINT centers_geofence_radius_range
  CHECK (geofence_radius_m BETWEEN 20 AND 50);
