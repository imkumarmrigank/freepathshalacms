-- Moving a child from one centre to another, and the record that it happened.
-- The move itself rewrites where the child is now; this table keeps where they
-- were, so a centre's past numbers can always be explained.

CREATE TABLE IF NOT EXISTS student_transfers (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id      BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  from_center_id  BIGINT NOT NULL REFERENCES centers(id),
  to_center_id    BIGINT NOT NULL REFERENCES centers(id),
  from_class_id   BIGINT REFERENCES class_levels(id),
  to_class_id     BIGINT REFERENCES class_levels(id),
  transferred_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  reason          TEXT,
  moved_history   BOOLEAN NOT NULL DEFAULT TRUE,
  -- what went with the child, counted at the time
  moved_attendance INTEGER NOT NULL DEFAULT 0,
  moved_ptm        INTEGER NOT NULL DEFAULT 0,
  moved_referrals  INTEGER NOT NULL DEFAULT 0,
  left_sports      INTEGER NOT NULL DEFAULT 0,
  transferred_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfer_somewhere CHECK (from_center_id <> to_center_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_student ON student_transfers (student_id, transferred_on DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_day ON student_transfers (transferred_on DESC);
