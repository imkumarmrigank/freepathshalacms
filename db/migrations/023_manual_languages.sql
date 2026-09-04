-- Most of the people who read the manual think in Hindi, and the centres draw
-- staff from several states. A manual is therefore keyed by role *and*
-- language, with English as the one that always exists.
ALTER TABLE manual_intro    ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE manual_tasks    ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE manual_pitfalls ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'en';

-- the primary key was the role alone; a role now has one row per language
ALTER TABLE manual_intro DROP CONSTRAINT IF EXISTS manual_intro_pkey;
ALTER TABLE manual_intro ADD PRIMARY KEY (role, lang);

DROP INDEX IF EXISTS idx_manual_tasks_role;
DROP INDEX IF EXISTS idx_manual_pitfalls_role;
CREATE INDEX IF NOT EXISTS idx_manual_tasks_book ON manual_tasks (role, lang, position);
CREATE INDEX IF NOT EXISTS idx_manual_pitfalls_book ON manual_pitfalls (role, lang, position);
