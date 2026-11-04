-- Rewritten from the two PL/pgSQL triggers. Statements are separated by //
CREATE TRIGGER trg_students_status_change BEFORE UPDATE ON students FOR EACH ROW
BEGIN
  IF NOT (NEW.status <=> OLD.status) AND (NEW.status_changed_at <=> OLD.status_changed_at) THEN
    SET NEW.status_changed_at = CURRENT_TIMESTAMP(6);
  END IF;
END
//
CREATE TRIGGER trg_enrollments_section_ins BEFORE INSERT ON enrollments FOR EACH ROW
BEGIN
  IF NEW.section IS NULL OR TRIM(NEW.section) = '' THEN
    SET NEW.section = COALESCE((SELECT default_section FROM centers WHERE id = NEW.center_id), 'M');
  ELSE
    SET NEW.section = UPPER(TRIM(NEW.section));
  END IF;
END
//
CREATE TRIGGER trg_enrollments_section_upd BEFORE UPDATE ON enrollments FOR EACH ROW
BEGIN
  IF NEW.section IS NULL OR TRIM(NEW.section) = '' THEN
    SET NEW.section = COALESCE((SELECT default_section FROM centers WHERE id = NEW.center_id), 'M');
  ELSE
    SET NEW.section = UPPER(TRIM(NEW.section));
  END IF;
END
//
