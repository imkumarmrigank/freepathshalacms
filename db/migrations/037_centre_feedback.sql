-- A mentor's account of a centre they work with. Deliberately separate from the
-- auditor's visit: an audit scores a centre against a checklist, this is what
-- the person who sits with the families thinks is going well and what is not.

CREATE TABLE IF NOT EXISTS centre_feedback (
  id                BIGSERIAL PRIMARY KEY,
  center_id         BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  mentor_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id        BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  visited_on        DATE NOT NULL DEFAULT CURRENT_DATE,
  rating            SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  topics            TEXT[] NOT NULL DEFAULT '{}',
  working_well      TEXT,
  needs_attention   TEXT,
  parent_voice      TEXT,
  urgent            BOOLEAN NOT NULL DEFAULT FALSE,
  -- the centre reads it unless the mentor says otherwise, because feedback the
  -- centre never sees cannot change anything there
  share_with_centre BOOLEAN NOT NULL DEFAULT TRUE,
  -- which language the mentor wrote the notes in, so nobody has to guess
  language          TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_centre_feedback_centre
  ON centre_feedback (center_id, visited_on DESC);
CREATE INDEX IF NOT EXISTS idx_centre_feedback_mentor
  ON centre_feedback (mentor_id, visited_on DESC);
CREATE INDEX IF NOT EXISTS idx_centre_feedback_urgent
  ON centre_feedback (visited_on DESC) WHERE urgent;
