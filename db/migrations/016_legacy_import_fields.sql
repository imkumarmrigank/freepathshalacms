-- Fields carried over from the centres' previous system (Vedmarg) that the
-- admission form does not ask for but the roster already held. Storing them
-- keeps the migrated records complete; the student profile displays them.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS legacy_student_id            TEXT,
  ADD COLUMN IF NOT EXISTS medium                       TEXT,
  ADD COLUMN IF NOT EXISTS is_rte                       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_bpl                       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dob_application_no           TEXT,
  ADD COLUMN IF NOT EXISTS samagra_id                   TEXT,
  ADD COLUMN IF NOT EXISTS reference                    TEXT,
  ADD COLUMN IF NOT EXISTS tc_date                      DATE,
  ADD COLUMN IF NOT EXISTS dropout_reason               TEXT,
  ADD COLUMN IF NOT EXISTS dropout_date                 DATE,
  ADD COLUMN IF NOT EXISTS mother_aadhaar_number        TEXT,
  ADD COLUMN IF NOT EXISTS father_aadhaar_number        TEXT,
  ADD COLUMN IF NOT EXISTS guardian_aadhaar_number      TEXT,
  ADD COLUMN IF NOT EXISTS mother_residential_address   TEXT,
  ADD COLUMN IF NOT EXISTS father_residential_address   TEXT,
  ADD COLUMN IF NOT EXISTS guardian_residential_address TEXT,
  ADD COLUMN IF NOT EXISTS mother_official_address      TEXT,
  ADD COLUMN IF NOT EXISTS father_official_address      TEXT,
  ADD COLUMN IF NOT EXISTS guardian_official_address    TEXT;

CREATE INDEX IF NOT EXISTS idx_students_legacy_id ON students (legacy_student_id);

-- Their admission numbers were only ever unique inside a centre: SBP and Fab
-- both issued 2463. Enrolment number stays the org-wide unique identity.
DROP INDEX IF EXISTS uniq_students_admission_no;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_students_center_admission_no
  ON students (center_id, admission_no) WHERE admission_no IS NOT NULL;
