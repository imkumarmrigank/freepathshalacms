-- The mentor's centre feedback becomes a six-parameter assessment (Good /
-- Average / Below average per parameter, scored out of 3) that can be saved as
-- a draft and finished later. Older rows keep their 1-5 rating and topics.
ALTER TABLE centre_feedback
  ADD COLUMN IF NOT EXISTS ratings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS overall_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft','submitted'));
