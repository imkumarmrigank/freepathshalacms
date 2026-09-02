-- Tests and marks. A teacher sets up a test for a class they hold, then enters
-- the whole class's marks in one grid.

CREATE TABLE IF NOT EXISTS exams (
  id             BIGSERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  exam_type      TEXT NOT NULL DEFAULT 'monthly'
                 CHECK (exam_type IN ('unit_test','monthly','quarterly','half_yearly','yearly','other')),
  subject        TEXT NOT NULL,
  center_id      BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
  exam_date      DATE NOT NULL,
  max_marks      NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
  pass_marks     NUMERIC(6,2) CHECK (pass_marks IS NULL OR pass_marks >= 0),
  term_label     TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','published')),
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exams_pass_within_max CHECK (pass_marks IS NULL OR pass_marks <= max_marks)
);
CREATE INDEX IF NOT EXISTS idx_exams_scope
  ON exams (session_id, center_id, class_level_id, exam_date DESC);

CREATE TABLE IF NOT EXISTS exam_marks (
  id             BIGSERIAL PRIMARY KEY,
  exam_id        BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id     BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id  BIGINT REFERENCES enrollments(id) ON DELETE SET NULL,
  -- NULL means "not entered yet"; absentees keep NULL with is_absent set
  marks_obtained NUMERIC(6,2) CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
  is_absent      BOOLEAN NOT NULL DEFAULT FALSE,
  remarks        TEXT,
  entered_by     BIGINT REFERENCES users(id),
  entered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_marks_student ON exam_marks (student_id);
