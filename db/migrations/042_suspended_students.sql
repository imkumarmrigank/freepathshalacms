-- Suspended: a child who has stopped coming — gone to the village, moved site,
-- stopped turning up — but whom the centre expects might come back. Unlike a
-- dropout it is not a verdict, and unlike "inactive" it says why and since when.
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN ('active','inactive','graduated','transferred','dropped','suspended'));

-- When and why a child stopped being on the roll — used for suspended and for
-- passed out (graduated) children; a dropout keeps its own dropout_* columns.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS left_on           DATE,
  ADD COLUMN IF NOT EXISTS left_reason       TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_suspended
  ON students (center_id, left_on DESC) WHERE status IN ('suspended','graduated');

-- Every return to the roll, with where the child came back to.
CREATE TABLE IF NOT EXISTS student_reactivations (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id      BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  from_status     TEXT NOT NULL,
  from_center_id  BIGINT REFERENCES centers(id),
  to_center_id    BIGINT NOT NULL REFERENCES centers(id),
  from_class_id   BIGINT REFERENCES class_levels(id),
  to_class_id     BIGINT NOT NULL REFERENCES class_levels(id),
  reactivated_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  left_reason     TEXT,
  note            TEXT,
  reactivated_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reactivations_day ON student_reactivations (reactivated_on DESC);
