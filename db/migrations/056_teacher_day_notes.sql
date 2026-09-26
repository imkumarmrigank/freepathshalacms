-- What a teacher did today, in their own words.
--
-- The system already knows when they arrived and who was in the register. It
-- knows nothing of the lesson: what was taught, what was set for homework,
-- what was used to teach it and whether it worked. That is the part only the
-- teacher can say, and the part a centre manager most wants to read.
--
-- One note per teacher per class per day: a teacher who takes two classes
-- writes two, and each is edited freely during the day rather than added to.
CREATE TABLE IF NOT EXISTS teacher_day_notes (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id        BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  class_level_id   BIGINT REFERENCES class_levels(id),
  session_id       BIGINT REFERENCES academic_sessions(id),
  on_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  subject          TEXT,
  chapter          TEXT,
  chapter_detail   TEXT,
  homework         TEXT,
  homework_detail  TEXT,
  equipment        TEXT,
  equipment_result TEXT,
  other_work       TEXT,
  support_needed   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One note per teacher, day and class; a note with no class named is the
-- teacher's day as a whole, and there is one of those too.
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_day_note
  ON teacher_day_notes (user_id, on_date, COALESCE(class_level_id, 0));

CREATE INDEX IF NOT EXISTS idx_teacher_day_notes
  ON teacher_day_notes (on_date DESC, center_id);
