-- The full admission form: everything the paper form asks for, plus photographs
-- and the ability to leave an admission half-finished and come back to it.

-- Photographs live in the database because Render's filesystem is ephemeral —
-- anything written to disk disappears on the next deploy.
CREATE TABLE IF NOT EXISTS media (
  id          BIGSERIAL PRIMARY KEY,
  mime        TEXT NOT NULL,
  byte_size   INTEGER NOT NULL,
  bytes       BYTEA NOT NULL,
  uploaded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_size CHECK (byte_size > 0 AND byte_size <= 3145728)   -- 3 MB
);

ALTER TABLE students
  -- identity
  ADD COLUMN IF NOT EXISTS admission_no       TEXT,
  ADD COLUMN IF NOT EXISTS registration_no    TEXT,
  ADD COLUMN IF NOT EXISTS photo_media_id     BIGINT REFERENCES media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS place_of_birth     TEXT,
  ADD COLUMN IF NOT EXISTS nationality        TEXT,
  ADD COLUMN IF NOT EXISTS religion           TEXT,
  ADD COLUMN IF NOT EXISTS caste              TEXT,
  ADD COLUMN IF NOT EXISTS category           TEXT,
  ADD COLUMN IF NOT EXISTS blood_group        TEXT,
  ADD COLUMN IF NOT EXISTS has_disability     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS disability_details TEXT,
  -- contact
  ADD COLUMN IF NOT EXISTS whatsapp_number    TEXT,
  ADD COLUMN IF NOT EXISTS house_block        TEXT,
  ADD COLUMN IF NOT EXISTS pincode            TEXT,
  ADD COLUMN IF NOT EXISTS city               TEXT,
  ADD COLUMN IF NOT EXISTS state              TEXT,
  ADD COLUMN IF NOT EXISTS country            TEXT DEFAULT 'India',
  -- mother
  ADD COLUMN IF NOT EXISTS mother_qualification TEXT,
  ADD COLUMN IF NOT EXISTS mother_occupation    TEXT,
  ADD COLUMN IF NOT EXISTS mother_income        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS mother_email         TEXT,
  ADD COLUMN IF NOT EXISTS mother_mobile        TEXT,
  ADD COLUMN IF NOT EXISTS mother_photo_media_id BIGINT REFERENCES media(id) ON DELETE SET NULL,
  -- father
  ADD COLUMN IF NOT EXISTS father_qualification TEXT,
  ADD COLUMN IF NOT EXISTS father_occupation    TEXT,
  ADD COLUMN IF NOT EXISTS father_income        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS father_email         TEXT,
  ADD COLUMN IF NOT EXISTS father_mobile        TEXT,
  ADD COLUMN IF NOT EXISTS father_photo_media_id BIGINT REFERENCES media(id) ON DELETE SET NULL,
  -- guardian
  ADD COLUMN IF NOT EXISTS guardian_qualification TEXT,
  ADD COLUMN IF NOT EXISTS guardian_occupation    TEXT,
  ADD COLUMN IF NOT EXISTS guardian_income        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS guardian_email         TEXT,
  ADD COLUMN IF NOT EXISTS guardian_mobile        TEXT,
  ADD COLUMN IF NOT EXISTS guardian_photo_media_id BIGINT REFERENCES media(id) ON DELETE SET NULL,
  -- admission and identification
  ADD COLUMN IF NOT EXISTS udise               BOOLEAN,
  ADD COLUMN IF NOT EXISTS rte_application_no  TEXT,
  ADD COLUMN IF NOT EXISTS apaar_id            TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_number      TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_students_admission_no
  ON students (admission_no) WHERE admission_no IS NOT NULL;

-- Running counters behind the generated admission and registration numbers.
CREATE TABLE IF NOT EXISTS number_counters (
  scope    TEXT PRIMARY KEY,          -- e.g. 'admission:2026'
  next_seq INTEGER NOT NULL DEFAULT 1
);

-- An admission part-filled and set aside. The payload is the wizard's own shape,
-- so a half-finished form never has to satisfy the students table's constraints.
CREATE TABLE IF NOT EXISTS admission_drafts (
  id           BIGSERIAL PRIMARY KEY,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  student_name TEXT,
  center_id    BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  created_by   BIGINT REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drafts_owner ON admission_drafts (created_by, updated_at DESC);
