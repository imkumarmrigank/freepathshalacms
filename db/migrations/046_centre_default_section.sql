-- Some centres run as one section only — SSC 46 Evening is the evening batch —
-- so a centre carries the section its children start in. It is M everywhere
-- unless set; a blank section on an enrolment takes its centre's default.
ALTER TABLE centers ADD COLUMN IF NOT EXISTS default_section TEXT NOT NULL DEFAULT 'M';
ALTER TABLE centers DROP CONSTRAINT IF EXISTS centers_default_section_m_e;
ALTER TABLE centers ADD CONSTRAINT centers_default_section_m_e
  CHECK (default_section IN ('M','E'));

UPDATE centers SET default_section = 'E' WHERE name ILIKE '%evening%';

-- and the children already at such a centre go to its section
UPDATE enrollments e SET section = c.default_section
  FROM centers c
 WHERE c.id = e.center_id AND c.default_section = 'E' AND e.section = 'M';

-- No column default: a section left out must reach the trigger blank, so it
-- can take the centre's section rather than a blanket M.
ALTER TABLE enrollments ALTER COLUMN section DROP DEFAULT;

CREATE OR REPLACE FUNCTION enrollments_default_section() RETURNS trigger AS $$
BEGIN
  IF NEW.section IS NULL OR btrim(NEW.section) = '' THEN
    NEW.section := COALESCE(
      (SELECT default_section FROM centers WHERE id = NEW.center_id), 'M');
  ELSE
    NEW.section := upper(btrim(NEW.section));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
