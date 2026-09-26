-- The check-in circle widened again, from 50 m to 70 m.
--
-- 50 m still refused staff standing in the yard or at the far gate: the fix
-- is a phone's ±20 m of error plus the width of a centre. 70 m covers the
-- building and its ground and stops there — past it a punch is no longer
-- proof of having arrived, which is the whole point of the circle.
--
-- The old rule comes off first. It forbids 70, so widening the centres under
-- it fails on the first row — the same way the absence rename did.
ALTER TABLE centers DROP CONSTRAINT IF EXISTS centers_geofence_radius_range;

UPDATE centers SET geofence_radius_m = 70 WHERE geofence_radius_m < 70;

ALTER TABLE centers ADD CONSTRAINT centers_geofence_radius_range
  CHECK (geofence_radius_m BETWEEN 20 AND 70);
ALTER TABLE centers ALTER COLUMN geofence_radius_m SET DEFAULT 70;
