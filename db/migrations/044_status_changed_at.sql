-- When a child's status last changed, recorded by the database itself. Several
-- screens change a status — the edit form, dropout, promotion, suspension,
-- bringing a child back — and a date that depended on each of them remembering
-- to write it would be missing for whichever one forgot.
CREATE OR REPLACE FUNCTION students_stamp_status_change() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status_changed_at IS NOT DISTINCT FROM OLD.status_changed_at THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_status_change ON students;
CREATE TRIGGER trg_students_status_change
  BEFORE UPDATE OF status ON students
  FOR EACH ROW EXECUTE FUNCTION students_stamp_status_change();
