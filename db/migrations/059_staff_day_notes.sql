-- What a mentor, an auditor or a sports teacher did today, in their own words.
--
-- Teachers already write their day up against the lesson. The other three do
-- work the system only partly sees: a mentor's afternoon in the basti, an
-- auditor's read of a centre, a coach's session in the yard. The counts on
-- the day books say how much; this says what, and it is the part a
-- superadmin actually wants to read.
--
-- One table, one row per person per day, with each role's own fields kept
-- apart and left null for the others. Three tables would have been three of
-- everything — queries, forms, panels — for the same three questions.
CREATE TABLE IF NOT EXISTS staff_day_notes (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           TEXT   NOT NULL,
  center_id      BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  session_id     BIGINT REFERENCES academic_sessions(id),
  on_date        DATE   NOT NULL DEFAULT CURRENT_DATE,

  -- asked of everyone
  summary        TEXT,          -- what you did today
  where_worked   TEXT,          -- the centres or the area covered
  plan_next      TEXT,          -- what is planned next
  support_needed TEXT,          -- what the office should know

  -- the mentor's day
  families_met   TEXT,          -- who was seen, and where
  home_visits    TEXT,          -- houses gone to, and why
  concerns       TEXT,          -- what the parents raised
  follow_ups     TEXT,          -- what was promised, by whom

  -- the auditor's day
  what_checked   TEXT,          -- what was looked at
  findings       TEXT,          -- what was found
  urgent_issues  TEXT,          -- what cannot wait
  told_to_centre TEXT,          -- what was said to the centre on the spot

  -- the sports teacher's day
  sports_covered TEXT,          -- which sports, which groups
  activities     TEXT,          -- what was actually played or drilled
  children_count INT,           -- how many took part
  equipment_used TEXT,
  equipment_need TEXT,          -- what is missing or broken
  talent_spotted TEXT,          -- a child worth following
  injuries       TEXT,          -- anything that happened, however small

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, on_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_day_notes ON staff_day_notes (on_date DESC, role, center_id);
