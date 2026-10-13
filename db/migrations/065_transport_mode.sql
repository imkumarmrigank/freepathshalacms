ALTER TABLE students
  ADD COLUMN IF NOT EXISTS transport_mode TEXT
    CHECK (transport_mode IN ('rickshaw', 'cycle', 'walk'));
