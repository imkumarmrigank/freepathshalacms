-- Restructure syllabus to a 3-term academic year (Apr–Mar).
--
-- Each term covers 3 months of teaching followed by 15 days of revision/exams:
--   Term 1: Apr 1 – Jun 30   → Revision: Jul 1–15
--   Term 2: Jul 16 – Oct 15  → Revision: Oct 16–31
--   Term 3: Nov 1 – Jan 31   → Revision: Feb 1–15
--   Year end: Feb 16 – Mar 31
--
-- The syllabus_units table gains term_no (1–3) and month_no is now 1–3
-- (the month within that term, not an absolute session month).

-- 1. Add term_no
ALTER TABLE syllabus_units
  ADD COLUMN IF NOT EXISTS term_no SMALLINT NOT NULL DEFAULT 1
  CHECK (term_no BETWEEN 1 AND 3);

-- 2. Migrate existing data: old month_no 1–4 → new term_no + month_no
--    month 1–3 stay in term 1, month 4 becomes term 2 month 1.
UPDATE syllabus_units SET term_no = 1, month_no = month_no
  WHERE month_no BETWEEN 1 AND 3;
UPDATE syllabus_units SET term_no = 2, month_no = 1
  WHERE month_no = 4;
-- Any stray month_no > 4 maps to term 3 month 1 (shouldn't exist in practice)
UPDATE syllabus_units SET term_no = 3, month_no = 1
  WHERE month_no > 4;

-- 3. Tighten month_no to 1–3
ALTER TABLE syllabus_units DROP CONSTRAINT IF EXISTS syllabus_units_month_no_check;
ALTER TABLE syllabus_units ADD CONSTRAINT syllabus_units_month_no_check
  CHECK (month_no BETWEEN 1 AND 3);

-- 4. Replace the uniqueness constraint to include term_no
ALTER TABLE syllabus_units DROP CONSTRAINT IF EXISTS syllabus_units_session_id_class_level_id_subject_month_no_key;
ALTER TABLE syllabus_units ADD CONSTRAINT syllabus_units_term_month_unique
  UNIQUE (session_id, class_level_id, subject, term_no, month_no);

-- 5. Update index
DROP INDEX IF EXISTS idx_syllabus_scope;
CREATE INDEX IF NOT EXISTS idx_syllabus_scope
  ON syllabus_units (session_id, class_level_id, subject, term_no, month_no);
