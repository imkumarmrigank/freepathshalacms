-- Staff may leave and come back during the day: a teacher who steps out for a
-- home visit should be able to check in again. Each in/out pair is its own row
-- here; staff_attendance keeps the day's summary (first in, last out, total
-- minutes worked) so every existing report goes on reading the same columns.

CREATE TABLE IF NOT EXISTS staff_punches (
  id                   BIGSERIAL PRIMARY KEY,
  attendance_id        BIGINT NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  att_date             DATE NOT NULL,
  check_in_at          TIMESTAMPTZ NOT NULL,
  check_in_lat         DOUBLE PRECISION,
  check_in_lng         DOUBLE PRECISION,
  check_in_distance_m  INTEGER,
  check_in_accuracy_m  INTEGER,
  check_out_at         TIMESTAMPTZ,
  check_out_lat        DOUBLE PRECISION,
  check_out_lng        DOUBLE PRECISION,
  check_out_distance_m INTEGER,
  check_out_accuracy_m INTEGER,
  worked_minutes       INTEGER,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_punch_day ON staff_punches(user_id, att_date);
CREATE INDEX IF NOT EXISTS idx_staff_punch_att ON staff_punches(attendance_id);

-- At most one spell may be open at a time, so a second "check in" cannot start
-- before the first is closed even if two devices submit together.
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_punch_open
  ON staff_punches(user_id, att_date) WHERE check_out_at IS NULL;

-- Every day already recorded becomes a single spell, so history keeps its hours.
INSERT INTO staff_punches
  (attendance_id, user_id, att_date, check_in_at, check_in_lat, check_in_lng,
   check_in_distance_m, check_in_accuracy_m, check_out_at, check_out_lat,
   check_out_lng, check_out_distance_m, worked_minutes)
SELECT a.id, a.user_id, a.att_date, a.check_in_at, a.check_in_lat, a.check_in_lng,
       a.check_in_distance_m, a.check_in_accuracy_m, a.check_out_at, a.check_out_lat,
       a.check_out_lng, a.check_out_distance_m, a.worked_minutes
  FROM staff_attendance a
 WHERE a.check_in_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM staff_punches p WHERE p.attendance_id = a.id);
