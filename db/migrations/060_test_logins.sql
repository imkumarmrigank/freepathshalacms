-- A test login: a real account somebody can sign in with, kept out of every
-- list, count and report so it never shows up as staff. Nothing about the
-- account is special otherwise — it is hidden, not privileged.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_test IS
  'A test login. Hidden from every staff list, count and report.';

-- Most reads want the real staff only.
CREATE INDEX IF NOT EXISTS idx_users_real ON users (role) WHERE NOT is_test;
