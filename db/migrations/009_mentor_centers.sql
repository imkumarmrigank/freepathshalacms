-- A mentor covers a set of centres, not necessarily every one of them.
CREATE TABLE IF NOT EXISTS mentor_centers (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id  BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, center_id)
);
CREATE INDEX IF NOT EXISTS idx_mentor_centers_center ON mentor_centers (center_id);

-- Mentors created before this table existed covered everything; keep that true
-- for them rather than silently emptying their scope.
INSERT INTO mentor_centers (user_id, center_id)
SELECT u.id, c.id FROM users u CROSS JOIN centers c
 WHERE u.role = 'mentor'
   AND NOT EXISTS (SELECT 1 FROM mentor_centers m WHERE m.user_id = u.id)
ON CONFLICT DO NOTHING;
