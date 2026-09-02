-- The form asks "please specify" when an occupation is Other, and that answer
-- had nowhere to go.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS mother_occupation_other   TEXT,
  ADD COLUMN IF NOT EXISTS father_occupation_other   TEXT,
  ADD COLUMN IF NOT EXISTS guardian_occupation_other TEXT;
