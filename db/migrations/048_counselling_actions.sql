-- What the mentor actually did about a flagged child, and when.
--
-- Until now a referral kept only its ending: one outcome line and the day it
-- was closed. An administrator looking at the list wants the steps in between
-- — the day the mentor picked the child up, each visit or phone call — so the
-- trail is kept as its own rows and the flag keeps the day it was picked up.
ALTER TABLE counselling_flags
  ADD COLUMN IF NOT EXISTS picked_up_on DATE;

CREATE TABLE IF NOT EXISTS counselling_actions (
  id         BIGSERIAL PRIMARY KEY,
  flag_id    BIGINT NOT NULL REFERENCES counselling_flags(id) ON DELETE CASCADE,
  kind       TEXT   NOT NULL CHECK (kind IN ('picked_up', 'note', 'closed', 'reopened')),
  note       TEXT,
  acted_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  acted_on   DATE   NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flag_actions ON counselling_actions (flag_id, acted_on DESC, id DESC);

-- Referrals already worked keep their history: the day a closed one ended is
-- the day of its action, and a referral in hand was picked up no later than
-- the last time it was touched.
UPDATE counselling_flags
   SET picked_up_on = LEAST(COALESCE(closed_on, CURRENT_DATE),
                            (updated_at AT TIME ZONE 'Asia/Kolkata')::date)
 WHERE picked_up_on IS NULL AND status <> 'open' AND mentor_id IS NOT NULL;

INSERT INTO counselling_actions (flag_id, kind, note, acted_by, acted_on)
SELECT f.id, 'closed', f.outcome, f.mentor_id, COALESCE(f.closed_on, CURRENT_DATE)
  FROM counselling_flags f
 WHERE f.status = 'closed'
   AND NOT EXISTS (SELECT 1 FROM counselling_actions a WHERE a.flag_id = f.id);
