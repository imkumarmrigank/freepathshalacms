-- Every class runs in two sections, M and E. Every child is placed in M to
-- begin with; an administrator moves the ones who belong in E.
UPDATE enrollments SET section = 'M' WHERE section IS NULL OR section NOT IN ('M','E');

ALTER TABLE enrollments ALTER COLUMN section SET DEFAULT 'M';

-- A section left blank by whatever wrote the enrolment — an admission, a
-- promotion, an import — becomes M rather than nothing, so no child is ever in
-- a class without a section.
CREATE OR REPLACE FUNCTION enrollments_default_section() RETURNS trigger AS $$
BEGIN
  IF NEW.section IS NULL OR btrim(NEW.section) = '' THEN
    NEW.section := 'M';
  ELSE
    NEW.section := upper(btrim(NEW.section));
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enrollments_section ON enrollments;
CREATE TRIGGER trg_enrollments_section
  BEFORE INSERT OR UPDATE OF section ON enrollments
  FOR EACH ROW EXECUTE FUNCTION enrollments_default_section();

ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_section_m_e;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_section_m_e
  CHECK (section IN ('M','E'));
