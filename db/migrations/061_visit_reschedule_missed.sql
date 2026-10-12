-- Auditor can reschedule an upcoming visit with a reason, and log why a
-- planned visit was missed (so admin/superadmin can see both on the record).

ALTER TABLE audit_visits
  ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_count  SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_reason     TEXT,
  ADD COLUMN IF NOT EXISTS missed_at         TIMESTAMPTZ;

-- A "missed" visit is a planned visit the auditor could not make on its day.
-- It stays on record (not cancelled) so the history is accurate.
ALTER TABLE audit_visits DROP CONSTRAINT IF EXISTS audit_visits_status_check;
ALTER TABLE audit_visits ADD CONSTRAINT audit_visits_status_check
  CHECK (status IN ('planned','in_progress','submitted','cancelled','missed'));
