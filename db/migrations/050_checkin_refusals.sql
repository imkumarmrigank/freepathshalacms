-- Every check-in the geofence turned away.
--
-- A refusal used to leave no trace: the teacher saw "you are too far", and
-- nobody else ever knew it had happened. That is the one event an
-- administrator needs, because the usual cause is not the teacher standing in
-- the wrong place — it is the centre's saved pin being wrong, and the distance
-- on these rows says so at a glance.
CREATE TABLE IF NOT EXISTS staff_checkin_refusals (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id   BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  att_date    DATE   NOT NULL DEFAULT CURRENT_DATE,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind        TEXT   NOT NULL CHECK (kind IN ('in', 'out')),
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  accuracy_m  INTEGER,
  distance_m  INTEGER,
  radius_m    INTEGER,
  reason      TEXT
);

CREATE INDEX IF NOT EXISTS idx_refusals_recent
  ON staff_checkin_refusals (att_date DESC, center_id);
