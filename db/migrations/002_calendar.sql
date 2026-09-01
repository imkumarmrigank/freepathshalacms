-- School calendar: holidays, PTM days, exams, feasts and any other event.
-- Created by super admins (all centres) or centre managers (their own centre),
-- visible to everyone.

CREATE TABLE IF NOT EXISTS calendar_events (
  id                 BIGSERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  event_type         TEXT NOT NULL DEFAULT 'event'
                     CHECK (event_type IN ('holiday','ptm','exam','event','feast',
                                           'activity','closure','other')),
  center_id          BIGINT REFERENCES centers(id) ON DELETE CASCADE,  -- NULL = every centre
  session_id         BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  is_all_day         BOOLEAN NOT NULL DEFAULT TRUE,
  start_time         TIME,
  end_time           TIME,
  description        TEXT,
  -- Holidays and closures suppress the nightly auto-absent close-out.
  affects_attendance BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         BIGINT REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_cal_range ON calendar_events (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_cal_center ON calendar_events (center_id, start_date);
CREATE INDEX IF NOT EXISTS idx_cal_attendance ON calendar_events (start_date, end_date)
  WHERE affects_attendance;
