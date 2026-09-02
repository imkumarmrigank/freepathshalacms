-- The Mentor role: works across every centre rather than being pinned to one,
-- and owns the supply chain from headquarters down to the student.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','mentor','center_manager','teacher'));

-- Stock as it arrives at headquarters, before any of it goes to a centre.
-- Stock in hand at HQ = what was received here - what has been sent to centres.
CREATE TABLE IF NOT EXISTS hq_supply_receipts (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES supply_items(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  received_on DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier    TEXT,
  invoice_no  TEXT,
  unit_cost   NUMERIC(10,2),
  remarks     TEXT,
  recorded_by BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hq_receipts_item
  ON hq_supply_receipts (item_id, received_on DESC);

-- Which mentor dispatched a consignment to a centre.
ALTER TABLE center_supply_receipts
  ADD COLUMN IF NOT EXISTS dispatched_by BIGINT REFERENCES users(id);
