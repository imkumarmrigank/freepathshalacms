-- A mid-session promotion is never someone's whim: it comes off a teacher's or
-- mentor's recommendation, or out of what was said at a parent meeting. Record
-- which, and point at the meeting when that is what it was.
ALTER TABLE promotion_moves
  ADD COLUMN IF NOT EXISTS recommended_by     TEXT,
  ADD COLUMN IF NOT EXISTS ptm_interaction_id BIGINT
    REFERENCES ptm_interactions(id) ON DELETE SET NULL;
