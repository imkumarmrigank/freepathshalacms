-- Two changes to why a child was absent.
--
-- "No idea" said what the teacher knew at the moment of marking, but it read
-- as a dead end when the office looked at it later: the honest meaning is
-- that somebody has to find out. It becomes "Need Followup", and the days
-- already marked with it are carried over — the answer has not changed, only
-- what it asks of whoever reads it.
--
-- "Visiting Hometown" joins the list: families here go back to the village
-- for weeks at a time, and until now that was filed under "Parents allowed
-- it", which hid the one pattern most worth seeing.
--
-- The old rule comes off before the rows are rewritten: "Need Followup" is
-- not a reason it allows, so renaming under it fails on the first row — as it
-- did on every register that actually had one.
ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_reason_check;

UPDATE student_attendance SET reason = 'Need Followup' WHERE reason = 'No idea';

ALTER TABLE student_attendance ADD CONSTRAINT student_attendance_reason_check CHECK (
  reason IS NULL
  OR (status = 'absent' AND reason IN (
        'Sick', 'Didn''t wake up', 'Distance issue', 'Parents allowed it',
        'Siblings responsibility', 'Visiting Hometown', 'Need Followup',
        'Parents not aware', 'Drop'))
  OR (status = 'leave' AND reason IN ('Approved leave', 'Festival', 'Marriage'))
);
