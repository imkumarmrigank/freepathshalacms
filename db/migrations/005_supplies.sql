-- Supplies: stationery and other material.
--   HQ (super admin) records what is sent to a centre.
--   The centre manager records what is handed to a student.
-- Stock in hand at a centre = received - issued.

CREATE TABLE IF NOT EXISTS supply_items (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  category   TEXT NOT NULL DEFAULT 'stationery'
             CHECK (category IN ('stationery','books','uniform','hygiene','equipment','other')),
  unit       TEXT NOT NULL DEFAULT 'piece',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS center_supply_receipts (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  center_id   BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  challan_no  TEXT,
  unit_cost   NUMERIC(10,2),
  remarks     TEXT,
  recorded_by BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipts_center ON center_supply_receipts(center_id, received_on DESC);

CREATE TABLE IF NOT EXISTS student_supply_issues (
  id         BIGSERIAL PRIMARY KEY,
  item_id    BIGINT NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  center_id  BIGINT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES academic_sessions(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  issued_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks    TEXT,
  issued_by  BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issues_center ON student_supply_issues(center_id, issued_on DESC);
CREATE INDEX IF NOT EXISTS idx_issues_student ON student_supply_issues(student_id);

INSERT INTO supply_items (name, category, unit) VALUES
  ('Notebook (ruled)', 'stationery', 'piece'),
  ('Pencil',           'stationery', 'piece'),
  ('Eraser',           'stationery', 'piece'),
  ('Geometry box',     'stationery', 'set'),
  ('School bag',       'other',      'piece'),
  ('Textbook set',     'books',      'set')
ON CONFLICT (name) DO NOTHING;
