-- The centres set four kinds of test: a monthly, and three promotional terms.
--
-- The older names stay legal because 1,866 exams already carry them — history
-- keeps the name it was filed under. They are simply no longer offered when
-- setting up a new test.
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE exams ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN (
    -- what a test can be set as today
    'monthly', 'promotional_t1', 'promotional_t2', 'promotional_t3',
    -- retired, kept so existing rows remain valid
    'unit_test', 'quarterly', 'half_yearly', 'yearly', 'other'
  ));
