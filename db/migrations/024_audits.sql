-- Centre audits.
--
-- An auditor visits a centre, rates it against a checklist, and leaves
-- suggestions the centre is expected to have acted on by the next visit. The
-- centre answers each suggestion in writing; the auditor gives a verdict on the
-- next visit. Both halves earn points, which is what the monthly Best Centre
-- award is decided on.

-- ------------------------------------------------------------- the new role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','admin','mentor','center_manager',
                  'teacher','backup_teacher','auditor'));

-- ------------------------------------------------------------- the checklist
-- Held in the database so the super admin can reword, reorder or retire a
-- criterion without a deploy. Past visits keep the wording they were scored
-- against — see audit_ratings.criterion_title — so editing this today does not
-- rewrite what an auditor said last month.
CREATE TABLE IF NOT EXISTS audit_criteria (
  id          BIGSERIAL PRIMARY KEY,
  section     TEXT NOT NULL,                    -- Children, Centre, Learning …
  position    INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,                    -- Attendance
  question    TEXT NOT NULL,                    -- How was today's attendance?
  -- what each of the four bands means, best first, so the auditor is choosing
  -- between described situations rather than guessing what "3 out of 4" means
  band_labels TEXT[] NOT NULL DEFAULT '{}',
  -- a low score has to be explained; these are the reasons offered
  reasons     TEXT[] NOT NULL DEFAULT '{}',
  weight      INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 5),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_criteria_order
  ON audit_criteria (is_active, position, id);

-- ----------------------------------------------------------------- the visit
CREATE TABLE IF NOT EXISTS audit_visits (
  id               BIGSERIAL PRIMARY KEY,
  center_id        BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  auditor_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  -- a special visit is a surprise: the centre is not shown it until it is
  -- submitted. See the read guards in src/lib/audits.ts.
  kind             TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (kind IN ('scheduled','follow_up','special')),
  status           TEXT NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','submitted','cancelled')),
  scheduled_for    DATE,
  visited_on       DATE,
  -- the headcount the auditor saw with their own eyes, which is the point of
  -- visiting rather than reading the register
  children_present INTEGER, children_on_roll INTEGER,
  staff_present    INTEGER, staff_on_roll    INTEGER,
  overall          TEXT CHECK (overall IN ('healthy','attention','support','urgent')),
  summary          TEXT,
  -- frozen at submission: recomputing later would silently restate history
  -- after a criterion's weight changed
  score_pct        NUMERIC(5,2),
  scheduled_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  submitted_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_center ON audit_visits (center_id, visited_on DESC);
CREATE INDEX IF NOT EXISTS idx_visits_auditor ON audit_visits (auditor_id, status);
CREATE INDEX IF NOT EXISTS idx_visits_due ON audit_visits (status, scheduled_for);

-- --------------------------------------------------------------- the ratings
CREATE TABLE IF NOT EXISTS audit_ratings (
  id              BIGSERIAL PRIMARY KEY,
  visit_id        BIGINT NOT NULL REFERENCES audit_visits(id) ON DELETE CASCADE,
  criterion_id    BIGINT REFERENCES audit_criteria(id) ON DELETE SET NULL,
  section         TEXT NOT NULL,
  criterion_title TEXT NOT NULL,   -- the wording as it stood on the day
  weight          INTEGER NOT NULL DEFAULT 1,
  -- 4 best … 1 worst; 0 means not applicable and is left out of the score
  band            SMALLINT NOT NULL CHECK (band BETWEEN 0 AND 4),
  reason          TEXT,
  note            TEXT,
  UNIQUE (visit_id, criterion_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_visit ON audit_ratings (visit_id);

-- ----------------------------------------------------------- the suggestions
CREATE TABLE IF NOT EXISTS audit_suggestions (
  id            BIGSERIAL PRIMARY KEY,
  visit_id      BIGINT REFERENCES audit_visits(id) ON DELETE SET NULL,
  center_id     BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  criterion_id  BIGINT REFERENCES audit_criteria(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  detail        TEXT,
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','critical')),
  due_on        DATE,
  -- open → the centre says done → the auditor gives a verdict on the next visit
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','done','verified','not_done','dropped')),
  raised_by     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  raised_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  -- the centre manager owns it; any teacher at the centre may answer on it
  done_claimed_on   DATE,
  verdict       TEXT CHECK (verdict IN ('done_well','partly','not_done')),
  verified_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  verified_visit_id BIGINT REFERENCES audit_visits(id) ON DELETE SET NULL,
  verified_on   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sugg_center ON audit_suggestions (center_id, status, due_on);
CREATE INDEX IF NOT EXISTS idx_sugg_visit ON audit_suggestions (visit_id);
CREATE INDEX IF NOT EXISTS idx_sugg_open ON audit_suggestions (status) WHERE status IN ('open','in_progress','done');

-- --------------------------------------------------------------- the replies
-- What the centre did about it, in their own words, and what the auditor said
-- back. Kept as a thread rather than one "response" column because a suggestion
-- is usually a conversation across two visits.
CREATE TABLE IF NOT EXISTS audit_replies (
  id            BIGSERIAL PRIMARY KEY,
  suggestion_id BIGINT NOT NULL REFERENCES audit_suggestions(id) ON DELETE CASCADE,
  author_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  -- set when this reply also moved the suggestion along, so the thread reads
  -- as a history rather than needing a separate audit log
  set_status    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_replies_sugg ON audit_replies (suggestion_id, id);

-- ------------------------------------------------------------ the scoreboard
-- Weighting between "how the centre looked on the day" and "whether it acted on
-- what it was told". Kept in a table so it can be tuned after a month of real
-- data without a deploy.
CREATE TABLE IF NOT EXISTS audit_settings (
  id                 BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  rating_weight_pct  INTEGER NOT NULL DEFAULT 60 CHECK (rating_weight_pct BETWEEN 0 AND 100),
  -- what a suggestion earns, out of 100, by how it was closed
  points_done_well   INTEGER NOT NULL DEFAULT 100,
  points_partly      INTEGER NOT NULL DEFAULT 50,
  points_late        INTEGER NOT NULL DEFAULT 60,
  points_not_done    INTEGER NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO audit_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;
