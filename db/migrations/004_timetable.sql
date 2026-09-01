-- Weekly timetable. A centre manager fills the grid for each class: which subject,
-- in which period, taught by which teacher.

CREATE TABLE IF NOT EXISTS timetable_slots (
  id             BIGSERIAL PRIMARY KEY,
  center_id      BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1 = Monday
  period_no      SMALLINT NOT NULL CHECK (period_no BETWEEN 1 AND 12),
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  subject        TEXT NOT NULL,
  teacher_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  room           TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timetable_times CHECK (end_time > start_time),
  -- one subject per class per period
  UNIQUE (center_id, session_id, class_level_id, day_of_week, period_no)
);

-- and a teacher can only be in one classroom at a time
CREATE UNIQUE INDEX IF NOT EXISTS timetable_teacher_busy
  ON timetable_slots (center_id, session_id, teacher_id, day_of_week, period_no)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tt_class
  ON timetable_slots (center_id, session_id, class_level_id, day_of_week, period_no);
CREATE INDEX IF NOT EXISTS idx_tt_teacher
  ON timetable_slots (teacher_id, session_id, day_of_week, period_no);
