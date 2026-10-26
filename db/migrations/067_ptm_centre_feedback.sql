-- Free-text feedback about the centre, captured on the PTM interaction form.
ALTER TABLE ptm_interactions
  ADD COLUMN IF NOT EXISTS centre_feedback TEXT;

-- What the follow-up is about, in the mentor's own words.
ALTER TABLE ptm_interactions
  ADD COLUMN IF NOT EXISTS follow_up_description TEXT;
