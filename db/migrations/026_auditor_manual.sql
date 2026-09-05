-- The auditor's handbook. Written here so a new auditor has something to read
-- on their first day; from then on it is the super admin's to edit like the
-- others. Seeded once and never overwritten.

INSERT INTO manual_intro (role, lang, headline, intro, routine_title, routine_items)
SELECT 'auditor', 'en',
  'Visiting a centre, and leaving it better than you found it',
  ARRAY[
    'Your job is not to catch a centre out. It is to see clearly what is working and what is not, say so plainly, and leave behind a short list of things that can actually be done before you come back.',
    'A suggestion nobody can act on is worse than no suggestion at all. Ask for one specific thing, say who should do it, and give a date that is realistic for a centre with two teachers and no budget.',
    'Everything you file is read by the centre manager, the teachers, and the administrators. Write as though the teacher standing in front of you will read it that evening, because they will.'
  ],
  'Every visit',
  ARRAY[
    'Open the visit from your list before you start looking around',
    'Deal with what is still owed from last time first',
    'Count the children and staff actually present',
    'Work down the checklist while you are still in the room',
    'Raise the suggestions, then file the report before you leave'
  ]
WHERE NOT EXISTS (SELECT 1 FROM manual_intro WHERE role = 'auditor' AND lang = 'en');

INSERT INTO manual_tasks (role, lang, position, title, why, path, steps, notes)
SELECT * FROM (VALUES
  ('auditor', 'en', 10,
   'Find the visits you have been given',
   'Visits are booked for you by an admin. You cannot book your own, and you cannot pick your own centres — that is deliberate, and it is what makes the report worth reading.',
   ARRAY['Centre audits','Visits & standing'],
   ARRAY[
     'Open Centre audits in the menu, then Visits & standing.',
     'The list shows your visits first. A planned one carries the date it is due.',
     'A visit marked Surprise is not shown to the centre until you file the report, so do not warn them you are coming.',
     'Tap the visit to open it when you arrive.'
   ],
   '[{"kind":"warn","title":"Cannot see a visit? ","body":"Only the auditor a visit is assigned to can fill it in. Ask the admin who booked it to reassign it to you."}]'::jsonb),

  ('auditor', 'en', 20,
   'Check what was owed from last time',
   'This is the part that makes an audit worth doing. A centre that was told to fix something in August should be asked about it in September — and it should count either way.',
   ARRAY['Centre audits','Visits & standing','open the visit'],
   ARRAY[
     'At the top of the visit you will see Still owed from earlier visits.',
     'Read what the centre wrote against each one — tap the link to see the whole conversation.',
     'Look at the thing itself. Do not take the written answer as proof.',
     'Choose a verdict: Done properly, Partly done, or Not done.',
     'Add a note saying what you actually saw this time. This is what the centre reads.'
   ],
   '[{"kind":"stop","title":"Be fair about late work. ","body":"Work finished after the date still counts for most of the marks. Mark it Done properly if it is done properly — the lateness is scored automatically."}]'::jsonb),

  ('auditor', 'en', 30,
   'Record what you found',
   'The headcount is the one number nobody can argue with later, and the overall rating is what shows against the centre on everybody''s dashboard.',
   ARRAY['Centre audits','Visits & standing','open the visit','Today''s snapshot'],
   ARRAY[
     'Count the children present yourself. Do not copy the register.',
     'Fill in how many are on the roll, so the figure means something.',
     'Do the same for staff: how many were there, how many should have been.',
     'Choose how you found the centre overall — Healthy through to Immediate intervention.',
     'Write a few lines in your own words, then Save snapshot.'
   ],
   '[{"kind":"warn","title":"Immediate intervention is not a strong word for a bad day. ","body":"Use it when a child is at risk or the centre cannot function. It puts the centre at the top of every administrator''s screen."}]'::jsonb),

  ('auditor', 'en', 40,
   'Work down the checklist',
   'Each point offers four described situations rather than a score out of four, so two auditors visiting the same centre reach roughly the same answer.',
   ARRAY['Centre audits','Visits & standing','open the visit'],
   ARRAY[
     'Take the sections in order. Each one saves on its own, so you can stop and come back.',
     'Pick the band that describes what you saw, not the one that feels kind.',
     'A weak or poor rating asks for the main reason. That reason is what the centre acts on.',
     'Use Does not apply when there is genuinely nothing to judge — it is left out of the score rather than counted as zero.',
     'Add a note where the band alone does not tell the story.'
   ],
   '[{"kind":"warn","title":"Save each point as you go. ","body":"Centres have poor signal. Every point saves by itself so a dropped connection costs you one answer, not the whole visit."}]'::jsonb),

  ('auditor', 'en', 50,
   'Leave suggestions the centre can act on',
   'This is what the visit is for. Everything you raise here appears on the manager''s and teachers'' dashboards until it is dealt with.',
   ARRAY['Centre audits','Visits & standing','open the visit','Suggestions for this centre'],
   ARRAY[
     'Write one specific thing that needs doing, not a general complaint.',
     'Add detail: who to speak to, and what "done" would look like.',
     'Set the priority honestly. Critical means it cannot wait three days.',
     'Set a date, or leave it and one is chosen to match the priority.',
     'Tie it to the check it came from, so the centre can see why you asked.'
   ],
   '[{"kind":"stop","title":"Three good suggestions beat ten. ","body":"A centre with two teachers cannot act on a list of ten. Ask for what matters most and come back for the rest."}]'::jsonb),

  ('auditor', 'en', 60,
   'File the report',
   'Nothing you have written is visible to the centre until you file it — and once filed, the ratings are fixed.',
   ARRAY['Centre audits','Visits & standing','open the visit','File the report'],
   ARRAY[
     'Check you have set how you found the centre overall.',
     'Check you have rated at least the points that mattered today.',
     'Press File report.',
     'The score is worked out and frozen at that moment. The centre can now read everything.'
   ],
   '[{"kind":"stop","title":"File before you leave. ","body":"A report left unfiled shows the centre nothing and counts for nothing. Finish it on site."}]'::jsonb),

  ('auditor', 'en', 70,
   'Follow the conversation between visits',
   'Centres reply in writing as they do the work. Reading those replies before your next visit is how you arrive already knowing what to look at.',
   ARRAY['Centre audits','Suggestions'],
   ARRAY[
     'Open Centre audits, then Suggestions.',
     'Overdue and critical items sort to the top.',
     'Open one to read what the centre has said and add a note of your own.',
     'You give the verdict at the next visit, not here — seeing it done is the point.'
   ],
   '[]'::jsonb)
) AS v(role, lang, position, title, why, path, steps, notes)
WHERE NOT EXISTS (SELECT 1 FROM manual_tasks WHERE role = 'auditor');

INSERT INTO manual_pitfalls (role, lang, position, problem, meaning)
SELECT * FROM (VALUES
  ('auditor', 'en', 10, 'That visit is assigned to another auditor',
   'Visits belong to one auditor. Ask the admin who booked it to move it to you.'),
  ('auditor', 'en', 20, 'This report is already filed',
   'Filed reports cannot be edited — that is what makes them worth reading. Anything further goes in as a suggestion or a note.'),
  ('auditor', 'en', 30, 'A low rating needs a reason',
   'Weak and Poor ask for the main reason. The centre cannot act on a low score with no explanation.'),
  ('auditor', 'en', 40, 'Set how you found the centre overall before filing',
   'The overall rating drives the centre''s priority flag, so a report cannot be filed without it.'),
  ('auditor', 'en', 50, 'This one has already been closed off',
   'Somebody has already given a verdict on that suggestion. If the problem is back, raise it again at this visit.')
) AS v(role, lang, position, problem, meaning)
WHERE NOT EXISTS (SELECT 1 FROM manual_pitfalls WHERE role = 'auditor');
