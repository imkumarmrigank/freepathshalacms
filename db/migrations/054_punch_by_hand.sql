-- Checking in from away from the centre, by hand.
--
-- The geofence is the rule, and it should stay the rule: a punch from the
-- doorway is proof of being there. But staff are sent out — home visits, a
-- second centre, training — and until now the system simply refused them,
-- which left an honest day's work looking like an absence.
--
-- So a punch may be entered by hand, but only from outside the fence, only
-- with a reason, and it is stamped as such wherever it is read.
ALTER TABLE staff_punches
  ADD COLUMN IF NOT EXISTS by_hand     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS away_reason TEXT;

ALTER TABLE staff_attendance
  ADD COLUMN IF NOT EXISTS by_hand     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS away_reason TEXT;
