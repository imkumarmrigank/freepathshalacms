-- Nursery and KG sit below Class 1 on the promotion ladder, so every existing
-- class shifts up two places. class_levels.sequence is UNIQUE and checked per
-- row, so the shift goes via a spare range rather than straight to its target.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM class_levels WHERE name = 'Nursery') THEN
    UPDATE class_levels SET sequence = sequence + 1000;   -- park out of the way
    UPDATE class_levels SET sequence = sequence - 998;    -- land two higher than before

    INSERT INTO class_levels (name, sequence, is_terminal, is_active) VALUES
      ('Nursery', 1, FALSE, TRUE),
      ('KG',      2, FALSE, TRUE);
  END IF;
END $$;
