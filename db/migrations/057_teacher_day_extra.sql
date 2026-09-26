-- Work that was not the class.
--
-- A teacher's day is not only the lesson: a community meeting, a child taken
-- to the clinic, a rehearsal for the function, a survey in the basti. Left to
-- "anything else", those went down in a line; given their own box, they can
-- be read as the work they are.
ALTER TABLE teacher_day_notes
  ADD COLUMN IF NOT EXISTS extra_activity TEXT,
  ADD COLUMN IF NOT EXISTS extra_detail   TEXT;
