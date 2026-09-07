-- Taking a child off the roll is the one thing on this system nobody should be
-- able to do quietly. The reason was already recorded; this adds the remarks
-- that go with it and, more importantly, who did it and when — so the dropout
-- report answers "who decided this, and on what grounds" rather than just
-- "how many".
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS dropout_remarks   TEXT,
  ADD COLUMN IF NOT EXISTS dropout_marked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dropout_marked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_dropped
  ON students (center_id, dropout_date DESC) WHERE status = 'dropped';
