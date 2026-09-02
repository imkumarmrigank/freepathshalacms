-- Three role changes:
--   1. the wide-reaching "mentor" becomes "admin" — same reach, honest name
--   2. "mentor" is reborn narrow: parent meetings, follow-ups and progress reports
--   3. "backup_teacher" stands in for an absent teacher at whichever centre needs one

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'admin' WHERE role = 'mentor';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','mentor','center_manager','teacher','backup_teacher'));

-- Admins and mentors both work across every centre, so a per-centre allotment
-- no longer means anything.
DROP TABLE IF EXISTS mentor_centers;

-- A follow-up can be handed to a particular teacher rather than staying with
-- whoever happened to record the interaction.
ALTER TABLE ptm_interactions
  ADD COLUMN IF NOT EXISTS follow_up_assignee_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ptmi_assignee
  ON ptm_interactions (follow_up_assignee_id, follow_up_status)
  WHERE follow_up_required;

-- Who is standing in for whom, where, and for how long. A backup teacher's reach
-- is derived from this table and nothing else.
CREATE TABLE IF NOT EXISTS teacher_coverage (
  id          BIGSERIAL PRIMARY KEY,
  backup_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  covering_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id   BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id  BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  starts_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on     DATE,                        -- NULL = until it is ended
  reason      TEXT,
  assigned_by BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coverage_dates CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT coverage_not_self CHECK (backup_id <> covering_id)
);
CREATE INDEX IF NOT EXISTS idx_coverage_backup ON teacher_coverage (backup_id, starts_on, ends_on);
CREATE INDEX IF NOT EXISTS idx_coverage_covering ON teacher_coverage (covering_id);
