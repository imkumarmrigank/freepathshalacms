-- The PTM form now mirrors the Freepathshala PTM Mentor Interaction Form, which
-- asks for several things the table had nowhere to put.

ALTER TABLE ptm_interactions
  ADD COLUMN IF NOT EXISTS concern_tags       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS commitment_tags    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS follow_up_priority TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_owner    TEXT,
  ADD COLUMN IF NOT EXISTS confidence         SMALLINT,
  ADD COLUMN IF NOT EXISTS support_needed     TEXT;

ALTER TABLE ptm_interactions DROP CONSTRAINT IF EXISTS ptm_follow_up_priority_check;
ALTER TABLE ptm_interactions ADD CONSTRAINT ptm_follow_up_priority_check
  CHECK (follow_up_priority IS NULL OR follow_up_priority IN ('high','medium','low'));

ALTER TABLE ptm_interactions DROP CONSTRAINT IF EXISTS ptm_confidence_check;
ALTER TABLE ptm_interactions ADD CONSTRAINT ptm_confidence_check
  CHECK (confidence IS NULL OR confidence BETWEEN 1 AND 5);

-- concerns are searched when looking for a pattern across families
CREATE INDEX IF NOT EXISTS idx_ptmi_concerns ON ptm_interactions USING GIN (concern_tags);
CREATE INDEX IF NOT EXISTS idx_ptmi_commitments ON ptm_interactions USING GIN (commitment_tags);
