-- FreePathshala CMS — initial schema
-- Roles: super_admin (HQ), center_manager (one per centre), teacher (mentor)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- settings
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- centres
CREATE TABLE IF NOT EXISTS centers (
  id                BIGSERIAL PRIMARY KEY,
  code              TEXT NOT NULL UNIQUE,          -- C04  (used inside enrolment no.)
  name              TEXT NOT NULL,
  area              TEXT,
  address           TEXT,
  city              TEXT,
  state             TEXT,
  pincode           TEXT,
  phone             TEXT,
  latitude          DOUBLE PRECISION,              -- geofence anchor for staff check-in
  longitude         DOUBLE PRECISION,
  geofence_radius_m INTEGER NOT NULL DEFAULT 150,
  manager_id        BIGINT,                        -- FK added after users
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  phone          TEXT,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('super_admin','center_manager','teacher')),
  center_id      BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  designation    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_center ON users(center_id);

ALTER TABLE centers DROP CONSTRAINT IF EXISTS centers_manager_fk;
ALTER TABLE centers ADD CONSTRAINT centers_manager_fk
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- academic sessions
CREATE TABLE IF NOT EXISTS academic_sessions (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,               -- 2026-27
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  sequence    INTEGER NOT NULL,                   -- ordering, 1,2,3...
  is_current  BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,     -- locked once promoted forward
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_one_current_session
  ON academic_sessions ((is_current)) WHERE is_current;

-- ---------------------------------------------------------------- class levels
CREATE TABLE IF NOT EXISTS class_levels (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,               -- Class 6
  sequence    INTEGER NOT NULL UNIQUE,            -- promotion order
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,     -- highest class -> graduates out
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------- students
CREATE TABLE IF NOT EXISTS students (
  id             BIGSERIAL PRIMARY KEY,
  enrollment_no  TEXT NOT NULL UNIQUE,
  center_id      BIGINT NOT NULL REFERENCES centers(id),
  first_name     TEXT NOT NULL,
  last_name      TEXT,
  gender         TEXT CHECK (gender IN ('male','female','other')),
  dob            DATE,
  father_name    TEXT,
  mother_name    TEXT,
  guardian_name  TEXT,
  primary_phone  TEXT,
  alt_phone      TEXT,
  email          TEXT,
  address        TEXT,
  photo_url      TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','graduated','transferred','dropped')),
  notes          TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_students_center ON students(center_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

-- per-centre running counter behind the enrolment number
CREATE TABLE IF NOT EXISTS enrollment_counters (
  center_id BIGINT PRIMARY KEY REFERENCES centers(id) ON DELETE CASCADE,
  next_seq  INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------- enrolments (student x session x class)
CREATE TABLE IF NOT EXISTS enrollments (
  id                 BIGSERIAL PRIMARY KEY,
  student_id         BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id         BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id     BIGINT NOT NULL REFERENCES class_levels(id),
  center_id          BIGINT NOT NULL REFERENCES centers(id),
  section            TEXT,
  roll_no            INTEGER,
  enrolled_on        DATE NOT NULL DEFAULT CURRENT_DATE,
  source             TEXT NOT NULL DEFAULT 'new'
                     CHECK (source IN ('new','promoted','retained','mid_session','transfer')),
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','completed','left','graduated')),
  promotion_decision TEXT NOT NULL DEFAULT 'promote'
                     CHECK (promotion_decision IN ('promote','retain','hold')),
  remarks            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_enr_session_class ON enrollments(session_id, class_level_id);
CREATE INDEX IF NOT EXISTS idx_enr_center ON enrollments(center_id);

-- ---------------------------------------------------------------- teacher -> class allocation
CREATE TABLE IF NOT EXISTS teacher_classes (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id  BIGINT NOT NULL REFERENCES class_levels(id) ON DELETE CASCADE,
  center_id       BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, session_id, class_level_id)
);

-- ---------------------------------------------------------------- student attendance (marked by teachers)
CREATE TABLE IF NOT EXISTS student_attendance (
  id             BIGSERIAL PRIMARY KEY,
  student_id     BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id  BIGINT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT NOT NULL REFERENCES class_levels(id),
  center_id      BIGINT NOT NULL REFERENCES centers(id),
  att_date       DATE NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('present','absent','late','half_day','leave','holiday')),
  remarks        TEXT,
  marked_by      BIGINT REFERENCES users(id),
  marked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, att_date)
);
CREATE INDEX IF NOT EXISTS idx_satt_date ON student_attendance(att_date);
CREATE INDEX IF NOT EXISTS idx_satt_class_date ON student_attendance(session_id, class_level_id, att_date);

-- ---------------------------------------------------------------- staff attendance (geofenced self check-in)
CREATE TABLE IF NOT EXISTS staff_attendance (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id          BIGINT NOT NULL REFERENCES centers(id),
  att_date           DATE NOT NULL,
  check_in_at        TIMESTAMPTZ,
  check_in_lat       DOUBLE PRECISION,
  check_in_lng       DOUBLE PRECISION,
  check_in_distance_m INTEGER,
  check_in_accuracy_m INTEGER,
  check_out_at       TIMESTAMPTZ,
  check_out_lat      DOUBLE PRECISION,
  check_out_lng      DOUBLE PRECISION,
  check_out_distance_m INTEGER,
  worked_minutes     INTEGER,
  status             TEXT NOT NULL DEFAULT 'present'
                     CHECK (status IN ('present','late','absent','leave','holiday')),
  within_geofence    BOOLEAN NOT NULL DEFAULT TRUE,
  override_by        BIGINT REFERENCES users(id),   -- manager approved an out-of-fence punch
  override_reason    TEXT,
  remarks            TEXT,
  UNIQUE (user_id, att_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_att_date ON staff_attendance(center_id, att_date);

-- ---------------------------------------------------------------- PTM
CREATE TABLE IF NOT EXISTS ptm_meetings (
  id             BIGSERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  center_id      BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT REFERENCES class_levels(id),   -- NULL = all classes
  meeting_date   DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  mode           TEXT NOT NULL DEFAULT 'in_person'
                 CHECK (mode IN ('in_person','phone','video','home_visit')),
  status         TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','ongoing','completed','cancelled')),
  agenda         TEXT,
  created_by     BIGINT REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptm_meet ON ptm_meetings(center_id, meeting_date);

CREATE TABLE IF NOT EXISTS ptm_interactions (
  id                BIGSERIAL PRIMARY KEY,
  meeting_id        BIGINT REFERENCES ptm_meetings(id) ON DELETE SET NULL,  -- NULL = ad-hoc interaction
  student_id        BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id        BIGINT NOT NULL REFERENCES academic_sessions(id),
  class_level_id    BIGINT REFERENCES class_levels(id),
  center_id         BIGINT NOT NULL REFERENCES centers(id),
  mentor_id         BIGINT REFERENCES users(id),
  interaction_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  mode              TEXT NOT NULL DEFAULT 'in_person'
                    CHECK (mode IN ('in_person','phone','video','home_visit')),
  parent_present    TEXT NOT NULL DEFAULT 'mother'
                    CHECK (parent_present IN ('mother','father','both','guardian','none')),
  engagement        TEXT NOT NULL DEFAULT 'neutral'
                    CHECK (engagement IN ('attentive','neutral','resistant')),
  attendance_pct    NUMERIC(5,2),
  marks_pct         NUMERIC(5,2),
  discussion        TEXT,
  concerns          TEXT,
  action_items      TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
  follow_up_date    DATE,
  follow_up_mode    TEXT CHECK (follow_up_mode IN ('phone','home_visit','center_visit','video')),
  follow_up_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (follow_up_status IN ('pending','done','cancelled')),
  follow_up_notes   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptmi_student ON ptm_interactions(student_id);
CREATE INDEX IF NOT EXISTS idx_ptmi_center_date ON ptm_interactions(center_id, interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ptmi_followup ON ptm_interactions(follow_up_status, follow_up_date)
  WHERE follow_up_required;

-- ---------------------------------------------------------------- promotion audit
CREATE TABLE IF NOT EXISTS promotion_runs (
  id               BIGSERIAL PRIMARY KEY,
  from_session_id  BIGINT NOT NULL REFERENCES academic_sessions(id),
  to_session_id    BIGINT NOT NULL REFERENCES academic_sessions(id),
  center_id        BIGINT REFERENCES centers(id),   -- NULL = all centres
  promoted_count   INTEGER NOT NULL DEFAULT 0,
  retained_count   INTEGER NOT NULL DEFAULT 0,
  graduated_count  INTEGER NOT NULL DEFAULT 0,
  skipped_count    INTEGER NOT NULL DEFAULT 0,
  run_by           BIGINT REFERENCES users(id),
  run_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes            TEXT
);
