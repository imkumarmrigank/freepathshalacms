-- Monthly tests for staff: a question bank the office keeps, and a paper drawn
-- from it for each person, each cycle.
--
-- Teachers first, but every table carries the role the question or the paper
-- belongs to, so mentors and sports teachers need no new tables — only their
-- own questions and their own settings row.

CREATE TABLE IF NOT EXISTS staff_test_questions (
  id            BIGSERIAL PRIMARY KEY,
  for_role      TEXT NOT NULL,
  topic         TEXT,
  -- both languages are required: the test is read in whichever one the person
  -- is comfortable with, and a question that exists in only one is unusable
  question_en   TEXT NOT NULL,
  question_hi   TEXT NOT NULL,
  options_en    TEXT[] NOT NULL,
  options_hi    TEXT[] NOT NULL,
  correct_index SMALLINT NOT NULL,
  note_en       TEXT,
  note_hi       TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT staff_q_options CHECK (
    array_length(options_en, 1) BETWEEN 2 AND 6
    AND array_length(options_hi, 1) = array_length(options_en, 1)
    AND correct_index >= 0 AND correct_index < array_length(options_en, 1))
);

CREATE INDEX IF NOT EXISTS idx_staff_q_role ON staff_test_questions (for_role, is_active);

-- How long the paper runs and how many questions it holds, per role.
CREATE TABLE IF NOT EXISTS staff_test_config (
  for_role         TEXT PRIMARY KEY,
  duration_minutes INT NOT NULL DEFAULT 10 CHECK (duration_minutes BETWEEN 1 AND 180),
  question_count   INT NOT NULL DEFAULT 10 CHECK (question_count BETWEEN 1 AND 50),
  tests_per_month  INT NOT NULL DEFAULT 4  CHECK (tests_per_month BETWEEN 1 AND 12),
  -- questions from this many recent papers are held back from the next one
  avoid_last_tests INT NOT NULL DEFAULT 2  CHECK (avoid_last_tests BETWEEN 0 AND 10),
  is_open          BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO staff_test_config (for_role) VALUES ('teacher')
  ON CONFLICT (for_role) DO NOTHING;

-- One paper: drawn when the person starts, and its clock runs from that moment.
CREATE TABLE IF NOT EXISTS staff_tests (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  for_role         TEXT NOT NULL,
  center_id        BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  cycle_month      DATE NOT NULL,                    -- the first of the month
  slot             SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 12),
  duration_minutes INT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  submitted_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'in_progress'
                   CHECK (status IN ('in_progress', 'submitted', 'expired')),
  score            INT,
  total            INT NOT NULL,
  -- one paper per person per slot: a second attempt at the same test would
  -- make the score meaningless
  UNIQUE (user_id, cycle_month, slot)
);

CREATE INDEX IF NOT EXISTS idx_staff_tests_user ON staff_tests (user_id, cycle_month DESC, slot DESC);
CREATE INDEX IF NOT EXISTS idx_staff_tests_recent ON staff_tests (for_role, started_at DESC);

CREATE TABLE IF NOT EXISTS staff_test_answers (
  id           BIGSERIAL PRIMARY KEY,
  test_id      BIGINT NOT NULL REFERENCES staff_tests(id) ON DELETE CASCADE,
  question_id  BIGINT NOT NULL REFERENCES staff_test_questions(id) ON DELETE RESTRICT,
  position     SMALLINT NOT NULL,
  chosen_index SMALLINT,
  is_correct   BOOLEAN,
  answered_at  TIMESTAMPTZ,
  UNIQUE (test_id, position),
  UNIQUE (test_id, question_id)
);
