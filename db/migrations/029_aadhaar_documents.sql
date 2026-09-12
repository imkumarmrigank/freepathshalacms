-- A scan of the Aadhaar card, alongside the number.
--
-- The centres are asked for proof when a child is put up for RTE or a state
-- scheme, and until now that proof lived in a folder on somebody's desk. The
-- image goes in the same media table as the photographs, so it inherits the
-- 3 MB cap and the signed-in-only route that serves them.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS aadhaar_media_id          BIGINT REFERENCES media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS father_aadhaar_media_id   BIGINT REFERENCES media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mother_aadhaar_media_id   BIGINT REFERENCES media(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guardian_aadhaar_media_id BIGINT REFERENCES media(id) ON DELETE SET NULL;
