-- The sports teacher's own day. They do not belong to a centre, so the staff
-- register — one row per person per day, at one centre — cannot hold it: a
-- morning at Sector 51 and an afternoon at DPS are two visits, each checked in
-- at the centre itself, and each closed with an account of what was done there.

CREATE TABLE IF NOT EXISTS sports_visits (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id            BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  visit_date           DATE NOT NULL,
  check_in_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_lat         DOUBLE PRECISION,
  check_in_lng         DOUBLE PRECISION,
  check_in_distance_m  INTEGER,
  check_in_accuracy_m  INTEGER,
  check_out_at         TIMESTAMPTZ,
  check_out_lat        DOUBLE PRECISION,
  check_out_lng        DOUBLE PRECISION,
  check_out_distance_m INTEGER,
  worked_minutes       INTEGER,
  -- the report: what happened at this centre on this visit
  sports_covered       TEXT[] NOT NULL DEFAULT '{}',
  children_count       INTEGER CHECK (children_count IS NULL OR children_count >= 0),
  activities           TEXT,
  highlights           TEXT,
  issues               TEXT,
  report_submitted_at  TIMESTAMPTZ,
  -- a visit left open past its day is closed with its report but no departure
  -- time, and says so, rather than inventing one
  closed_late          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sports_visit_report CHECK (
    report_submitted_at IS NULL OR activities IS NOT NULL
  )
);

-- One place at a time: a second centre cannot be started while one is open.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_visit_open
  ON sports_visits (user_id) WHERE report_submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sports_visits_day ON sports_visits (visit_date, user_id);
CREATE INDEX IF NOT EXISTS idx_sports_visits_centre ON sports_visits (center_id, visit_date);
