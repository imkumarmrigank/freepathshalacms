-- "Promotional" without a term number, after a second look at how the centres
-- actually name these. The T1/T2/T3 variants never reached production data but
-- stay legal in case a test was set in the few minutes they existed.
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE exams ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN (
    -- what a test can be set as today
    'monthly', 'promotional',
    -- retired, kept so existing rows remain valid
    'promotional_t1', 'promotional_t2', 'promotional_t3',
    'unit_test', 'quarterly', 'half_yearly', 'yearly', 'other'
  ));
