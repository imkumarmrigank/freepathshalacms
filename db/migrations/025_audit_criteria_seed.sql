-- The starting checklist. Seeded once; from then on it is the super admin's to
-- edit, so this only fills an empty table and never overwrites their wording.
INSERT INTO audit_criteria (section, position, title, question, band_labels, reasons, weight)
SELECT * FROM (VALUES
  ('Children', 10, 'Attendance', 'How was today''s attendance?',
   ARRAY['90% or more of the roll present','75–89% present','50–74% present','Below 50% present'],
   ARRAY['Children absent regularly','Late arrival','Family or work reasons','Weather or local issue','Centre timing issue','Other'], 3),
  ('Children', 20, 'Punctuality', 'Did children arrive and settle on time?',
   ARRAY['Nearly all on time','A few latecomers','Many arrived late','Class started very late'],
   ARRAY['Distance from home','Parents'' work hours','Weather or local issue','No reminder from centre','Other'], 1),
  ('Children', 30, 'Hygiene', 'How well did children follow hygiene practices?',
   ARRAY['Clean, handwashing followed','Mostly followed','Followed by some','Not followed'],
   ARRAY['No water or soap','Not taught recently','No routine in place','Other'], 2),

  ('Centre', 40, 'Opening', 'How was the centre when class started?',
   ARRAY['Open on time, ready','Open, some setting up left','Opened late','Not open at the stated time'],
   ARRAY['Teacher arrived late','Key or access problem','Cleaning not done','Other'], 2),
  ('Centre', 50, 'Cleanliness', 'Was the teaching space clean and usable?',
   ARRAY['Clean and tidy throughout','Broadly clean','Visibly dirty in places','Unfit to teach in'],
   ARRAY['No cleaning staff','Materials left out','Waterlogging or dust','Other'], 2),
  ('Centre', 60, 'Safety', 'Is the space safe for children?',
   ARRAY['No hazards seen','Minor hazards, easily fixed','Real hazards present','Unsafe — children at risk'],
   ARRAY['Exposed wiring','Broken furniture','Unsafe entry or stairs','Open water or drain','Other'], 3),

  ('Learning', 70, 'Teaching in progress', 'Was teaching actually happening during the visit?',
   ARRAY['Full class engaged','Teaching on, some children idle','Little teaching seen','No teaching happening'],
   ARRAY['Teacher absent','No plan prepared','Children unsettled','Materials missing','Other'], 3),
  ('Learning', 80, 'Teaching plan followed', 'Was the day''s teaching plan being followed?',
   ARRAY['Followed and up to date','Followed loosely','Plan exists but not followed','No plan for the day'],
   ARRAY['Plan not written','Teacher new to the class','Syllabus behind','Other'], 2),
  ('Learning', 90, 'Children needing support', 'Were children needing support identified and helped?',
   ARRAY['Identified and being helped','Identified, help not started','Not identified','Struggling children ignored'],
   ARRAY['Class too large','No assessment done','Teacher unaware','Other'], 2),

  ('Teacher', 100, 'Teacher presence', 'Were the expected teachers present?',
   ARRAY['All present','One absent, covered','One absent, not covered','More than one absent'],
   ARRAY['Illness','Leave not informed','Cover not arranged','Other'], 3),
  ('Teacher', 110, 'Records up to date', 'Are the register and records current?',
   ARRAY['All current','A day or two behind','More than a week behind','Not maintained'],
   ARRAY['Teacher unfamiliar with system','No phone or network','Time pressure','Other'], 2),
  ('Teacher', 120, 'Conduct with children', 'How did staff speak to and handle children?',
   ARRAY['Warm and encouraging','Correct but distant','Sharp or dismissive','Harsh — needs intervention'],
   ARRAY['Class overcrowded','Staff under strain','Needs training','Other'], 3),

  ('Facilities', 130, 'Drinking water', 'Was safe drinking water available?',
   ARRAY['Available and clean','Available, storage poor','Available irregularly','Not available'],
   ARRAY['Supply failure','No storage vessel','Not refilled','Other'], 2),
  ('Facilities', 140, 'Toilet', 'Was a usable toilet available?',
   ARRAY['Clean and usable','Usable, needs cleaning','Barely usable','Not usable or not available'],
   ARRAY['No water','Not cleaned','Broken or locked','Other'], 2),
  ('Facilities', 150, 'Teaching materials', 'Were books and materials sufficient?',
   ARRAY['Sufficient for every child','Enough to share','Short for the class','Largely missing'],
   ARRAY['Stock not dispatched','Damaged or lost','Numbers grew','Other'], 2),

  ('Community', 160, 'Parent contact', 'Is the centre keeping parents engaged?',
   ARRAY['Regular contact, PTMs held','Some contact','Little contact','No contact'],
   ARRAY['Parents work long hours','No follow-up done','Language barrier','Other'], 1),
  ('Community', 170, 'Dropout follow-up', 'Are absent and dropped-out children being chased?',
   ARRAY['Followed up and recorded','Followed up informally','Rarely followed up','Not followed up'],
   ARRAY['Family moved','No contact number','No time','Other'], 2)
) AS v(section, position, title, question, band_labels, reasons, weight)
WHERE NOT EXISTS (SELECT 1 FROM audit_criteria);
