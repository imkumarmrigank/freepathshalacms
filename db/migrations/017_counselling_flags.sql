-- A teacher sees a child struggling and asks the mentor to sit with them. The
-- flag is the referral: reasons picked from a list so the report can group them,
-- and a note in the teacher's own words.
CREATE TABLE IF NOT EXISTS counselling_flags (
  id              BIGSERIAL PRIMARY KEY,
  student_id      BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  center_id       BIGINT NOT NULL REFERENCES centers(id),
  session_id      BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  class_level_id  BIGINT REFERENCES class_levels(id),
  reasons         TEXT[] NOT NULL DEFAULT '{}',
  note            TEXT,
  urgency         TEXT NOT NULL DEFAULT 'normal'
                    CHECK (urgency IN ('normal', 'high')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'closed')),
  raised_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  raised_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  mentor_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  outcome         TEXT,
  closed_on       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flags_student ON counselling_flags (student_id);
CREATE INDEX IF NOT EXISTS idx_flags_open ON counselling_flags (status, raised_on DESC);
CREATE INDEX IF NOT EXISTS idx_flags_center ON counselling_flags (center_id, status);

-- one live referral per child; closing it lets a new one be raised
CREATE UNIQUE INDEX IF NOT EXISTS uniq_flag_open_per_student
  ON counselling_flags (student_id) WHERE status <> 'closed';
