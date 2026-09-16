-- Why a child was absent or on leave.
--
-- Chosen from a fixed list rather than typed, so a centre's absences can be
-- counted by cause — whether a class is losing children to illness, to looking
-- after younger siblings, or to nobody at home knowing they skipped.
--
-- The column stays optional. The register closes unmarked days as leave on its
-- own, with nobody to give a reason, and the months of attendance imported from
-- the old registers carry none either. A reason is required whenever a teacher
-- marks someone absent or on leave; that is enforced where the mark is saved.
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_reason_check;
ALTER TABLE student_attendance ADD CONSTRAINT student_attendance_reason_check CHECK (
  reason IS NULL
  OR (status = 'absent' AND reason IN ('Sick', 'Didn''t wake up', 'Distance issue', 'Parents allowed it', 'Siblings responsibility', 'No idea', 'Parents not aware', 'Drop'))
  OR (status = 'leave'  AND reason IN ('Approved leave', 'Festival', 'Marriage'))
);
CREATE INDEX IF NOT EXISTS idx_satt_reason
  ON student_attendance (center_id, reason) WHERE reason IS NOT NULL;
