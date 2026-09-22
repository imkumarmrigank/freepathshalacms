-- A sports teacher's note on a child in a sport — anything worth writing
-- down that is not a test mark: "needs proper shoes", "captain of the team".
ALTER TABLE sport_students
  ADD COLUMN IF NOT EXISTS remarks            TEXT,
  ADD COLUMN IF NOT EXISTS remarks_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remarks_by         BIGINT REFERENCES users(id) ON DELETE SET NULL;
