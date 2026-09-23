-- Check-in circle widened to the full 50 m at every centre.
--
-- The centres were sitting at the 20 m floor, which a phone's own ±10–20 m of
-- error eats entirely: staff standing in the doorway were being refused. 50 m
-- is the widest the system allows and still means "at the centre" — a class
-- room and its yard, not the next street.
UPDATE centers SET geofence_radius_m = 50 WHERE geofence_radius_m < 50;
