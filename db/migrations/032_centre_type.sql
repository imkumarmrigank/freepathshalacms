-- Where a centre actually runs. Some meet in a park in the open; others use a
-- school's rooms after the school's own day has finished. The difference
-- matters in practice — a park centre stops for rain and has no building to pin
-- a check-in to, a school centre cannot start until the school has emptied.
--
-- Left empty for the centres that already exist rather than guessed at; the
-- centres page flags the ones still to be set.
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS center_type TEXT
    CHECK (center_type IS NULL OR center_type IN ('park', 'school'));
