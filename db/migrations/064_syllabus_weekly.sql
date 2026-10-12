-- Add week_no (1–4) to syllabus_items
ALTER TABLE syllabus_items ADD COLUMN IF NOT EXISTS week_no INTEGER NOT NULL DEFAULT 1;

-- Distribute existing items into 4 equal groups within each unit
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY unit_id ORDER BY position, id) AS rn,
    COUNT(*)     OVER (PARTITION BY unit_id)                        AS total
  FROM syllabus_items
)
UPDATE syllabus_items si
SET week_no = GREATEST(1, LEAST(4,
  CEIL(r.rn::numeric / NULLIF(r.total, 0) * 4)::int
))
FROM ranked r
WHERE r.id = si.id;

-- Per-week remarks (status/notes a teacher adds once they finish a week)
CREATE TABLE IF NOT EXISTS syllabus_week_progress (
  id         BIGSERIAL PRIMARY KEY,
  unit_id    BIGINT NOT NULL REFERENCES syllabus_units(id) ON DELETE CASCADE,
  center_id  BIGINT NOT NULL REFERENCES centers(id)        ON DELETE CASCADE,
  week_no    INTEGER NOT NULL CHECK (week_no BETWEEN 1 AND 4),
  remarks    TEXT,
  marked_by  BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, center_id, week_no)
);

CREATE INDEX IF NOT EXISTS idx_swp_unit  ON syllabus_week_progress (unit_id, center_id);
