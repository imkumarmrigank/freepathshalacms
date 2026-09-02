-- Promotion has two halves. At the year end it follows the result: a child who
-- passed moves up, a child who did not repeats the class. During the session a
-- child who is plainly ready can be moved up on their own, without waiting.
ALTER TABLE promotion_runs
  ALTER COLUMN from_session_id DROP NOT NULL,
  ALTER COLUMN to_session_id   DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES academic_sessions(id),
  ADD COLUMN IF NOT EXISTS kind       TEXT NOT NULL DEFAULT 'session';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promotion_runs_kind_check') THEN
    ALTER TABLE promotion_runs
      ADD CONSTRAINT promotion_runs_kind_check CHECK (kind IN ('session', 'manual'));
  END IF;
END $$;

-- Every class change a promotion made, so a child's path through the year is
-- still readable after the enrolment row itself has moved on.
CREATE TABLE IF NOT EXISTS promotion_moves (
  id                  BIGSERIAL PRIMARY KEY,
  run_id              BIGINT REFERENCES promotion_runs(id) ON DELETE SET NULL,
  student_id          BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id       BIGINT REFERENCES enrollments(id) ON DELETE SET NULL,
  session_id          BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  from_class_level_id BIGINT REFERENCES class_levels(id),
  to_class_level_id   BIGINT REFERENCES class_levels(id),
  decision            TEXT NOT NULL
                        CHECK (decision IN ('promoted', 'retained', 'graduated')),
  basis               TEXT NOT NULL DEFAULT 'manual'
                        CHECK (basis IN ('result', 'manual', 'no_result')),
  reason              TEXT,
  moved_on            DATE NOT NULL DEFAULT CURRENT_DATE,
  moved_by            BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moves_student ON promotion_moves (student_id, moved_on DESC);
CREATE INDEX IF NOT EXISTS idx_moves_run ON promotion_moves (run_id);
