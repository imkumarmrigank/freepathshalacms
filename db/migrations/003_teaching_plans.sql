-- Teaching plans: a teacher lays out the topics for a class, then marks each one
-- taught, with remarks on what went wrong and which aids or references were used.

CREATE TABLE IF NOT EXISTS teaching_plans (
  id             BIGSERIAL PRIMARY KEY,
  title          TEXT NOT NULL,
  subject        TEXT,
  center_id      BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  session_id     BIGINT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_level_id BIGINT NOT NULL REFERENCES class_levels(id),
  teacher_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description    TEXT,
  starts_on      DATE,
  ends_on        DATE,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','completed','archived')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plans_teacher ON teaching_plans(teacher_id, session_id);
CREATE INDEX IF NOT EXISTS idx_plans_class ON teaching_plans(session_id, class_level_id, center_id);

CREATE TABLE IF NOT EXISTS teaching_plan_topics (
  id             BIGSERIAL PRIMARY KEY,
  plan_id        BIGINT NOT NULL REFERENCES teaching_plans(id) ON DELETE CASCADE,
  sequence       INTEGER NOT NULL DEFAULT 1,
  topic          TEXT NOT NULL,
  objective      TEXT,
  planned_date   DATE,
  status         TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','in_progress','completed','skipped')),
  taught_on      DATE,
  taught_by      BIGINT REFERENCES users(id),
  -- filled in when the topic is marked taught
  remarks        TEXT,   -- how the class went
  resources_used TEXT,   -- gadgets, videos, references used to clear doubts
  issues_faced   TEXT,   -- what got in the way
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_topics_plan ON teaching_plan_topics(plan_id, sequence);
CREATE INDEX IF NOT EXISTS idx_topics_status ON teaching_plan_topics(status);
