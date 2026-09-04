-- A holiday posted to every centre sometimes does not apply to one of them:
-- Janmashtami is a holiday everywhere, but one centre chooses to run that day.
-- Rather than splitting the event into eleven copies, the centres that stay
-- open are recorded as exceptions to it.
CREATE TABLE IF NOT EXISTS calendar_event_exceptions (
  event_id   BIGINT NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  center_id  BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, center_id)
);

CREATE INDEX IF NOT EXISTS idx_event_exceptions_center
  ON calendar_event_exceptions (center_id);
