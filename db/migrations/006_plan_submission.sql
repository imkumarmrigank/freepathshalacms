-- A teaching plan is drafted by the teacher and then submitted. The rule is that a
-- plan must be submitted at least 7 days before the week of teaching it covers, so
-- the centre manager has time to read it.

ALTER TABLE teaching_plans DROP CONSTRAINT IF EXISTS teaching_plans_status_check;
ALTER TABLE teaching_plans
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES users(id);

-- existing plans keep working; new ones start as drafts
ALTER TABLE teaching_plans ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE teaching_plans ADD CONSTRAINT teaching_plans_status_check
  CHECK (status IN ('draft','submitted','active','completed','archived'));

-- anything already created before this rule counts as submitted
UPDATE teaching_plans SET status = 'submitted', submitted_at = created_at,
       submitted_by = teacher_id
 WHERE status = 'active' AND submitted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_plans_status ON teaching_plans(status, starts_on);
