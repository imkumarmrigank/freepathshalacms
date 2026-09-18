-- Brothers and sisters, recorded rather than guessed at.
--
-- Families here share a phone and, on paper, share the parents' Aadhaar — so a
-- second child from the same family looks exactly like a duplicate record. The
-- admission form now asks, and this is where the answer goes: once a pair is
-- confirmed as siblings the question is not asked about them again, and a
-- centre can see a child's brothers and sisters on their page.
--
-- Stored as an unordered pair so a link exists once, not twice, and cannot be
-- recorded the wrong way round.
CREATE TABLE IF NOT EXISTS student_siblings (
  student_a   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_b   BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  confirmed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_a, student_b),
  CONSTRAINT siblings_ordered CHECK (student_a < student_b)
);
CREATE INDEX IF NOT EXISTS idx_siblings_b ON student_siblings (student_b);
