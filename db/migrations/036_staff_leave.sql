-- Leave a teacher asks for and an administrator answers. Kept apart from
-- staff_attendance: that table records what happened on a day, this one records
-- a request and its decision. Approving writes 'leave' into the register for
-- the days concerned, which is the only place the two meet.

CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id     BIGINT REFERENCES centers(id) ON DELETE SET NULL,
  leave_type    TEXT NOT NULL
                CHECK (leave_type IN ('casual','sick','emergency','planned','unpaid')),
  starts_on     DATE NOT NULL,
  ends_on       DATE NOT NULL,
  half_day      BOOLEAN NOT NULL DEFAULT FALSE,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by    BIGINT REFERENCES users(id),
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_dates CHECK (ends_on >= starts_on),
  -- a decision without a decider, or the reverse, would make the queue lie
  CONSTRAINT leave_decided CHECK (
    (status IN ('pending','cancelled')) = (decided_by IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_leave_person ON staff_leave_requests (user_id, starts_on DESC);
CREATE INDEX IF NOT EXISTS idx_leave_queue  ON staff_leave_requests (status, starts_on);
CREATE INDEX IF NOT EXISTS idx_leave_span   ON staff_leave_requests (starts_on, ends_on)
  WHERE status = 'approved';
