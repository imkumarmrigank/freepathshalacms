-- Sports: a sports teacher who goes from centre to centre, the games each
-- centre plays, who is in them, whether they turned up, how they did in a
-- test, and which children have a gift worth nurturing.
--
-- Kept apart from the classroom tables on purpose. A child is enrolled in a
-- class by the centre; they join a sport because they want to, and a sport
-- test is not a paper that belongs on the report card's academic grid.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','mentor','center_manager',
                  'teacher','backup_teacher','auditor','sports_teacher'));

-- ---------------------------------------------------------------- the games
CREATE TABLE IF NOT EXISTS sports (
  id          BIGSERIAL PRIMARY KEY,
  center_id   BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one "Kho-kho" per centre, however it is capitalised
CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_centre_name
  ON sports (center_id, lower(name));

-- ---------------------------------------------------------- who plays what
CREATE TABLE IF NOT EXISTS sport_students (
  id                BIGSERIAL PRIMARY KEY,
  sport_id          BIGINT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  student_id        BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_on         DATE NOT NULL DEFAULT CURRENT_DATE,
  left_on           DATE,
  added_by          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  -- the child's gift, if they have one: what it is, and how far it might go
  is_special        BOOLEAN NOT NULL DEFAULT FALSE,
  speciality        TEXT,
  special_level     TEXT CHECK (special_level IS NULL OR special_level IN
                      ('centre','district','state','national')),
  special_marked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  special_marked_at TIMESTAMPTZ,
  UNIQUE (sport_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_sport_students_student ON sport_students (student_id);
CREATE INDEX IF NOT EXISTS idx_sport_students_special ON sport_students (sport_id) WHERE is_special;

-- -------------------------------------------------------------- attendance
CREATE TABLE IF NOT EXISTS sport_attendance (
  id         BIGSERIAL PRIMARY KEY,
  sport_id   BIGINT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  att_date   DATE NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('present','absent')),
  marked_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sport_id, student_id, att_date)
);
CREATE INDEX IF NOT EXISTS idx_sport_att_day ON sport_attendance (sport_id, att_date);

-- ------------------------------------------------------------ tests, marks
CREATE TABLE IF NOT EXISTS sport_tests (
  id         BIGSERIAL PRIMARY KEY,
  sport_id   BIGINT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  test_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  max_marks  NUMERIC(6,2) NOT NULL CHECK (max_marks > 0),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sport_tests_sport ON sport_tests (sport_id, test_date DESC);

CREATE TABLE IF NOT EXISTS sport_marks (
  id         BIGSERIAL PRIMARY KEY,
  test_id    BIGINT NOT NULL REFERENCES sport_tests(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks      NUMERIC(6,2) CHECK (marks IS NULL OR marks >= 0),
  is_absent  BOOLEAN NOT NULL DEFAULT FALSE,
  remarks    TEXT,
  marked_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  marked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_id),
  -- a child who was not there has no score, and one with a score was there
  CONSTRAINT sport_marks_absent CHECK (NOT (is_absent AND marks IS NOT NULL))
);
