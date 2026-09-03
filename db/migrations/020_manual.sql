-- The training manual moves out of the code so the super admin can correct it
-- without a deploy. Content is per role; the two roles that share a manual
-- (teacher/backup teacher, admin/super admin) share a row by pointing at the
-- same key rather than duplicating the text.
CREATE TABLE IF NOT EXISTS manual_intro (
  role           TEXT PRIMARY KEY,
  headline       TEXT NOT NULL,
  intro          TEXT[] NOT NULL DEFAULT '{}',
  routine_title  TEXT NOT NULL DEFAULT 'Every day',
  routine_items  TEXT[] NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS manual_tasks (
  id                BIGSERIAL PRIMARY KEY,
  role              TEXT NOT NULL,
  position          INTEGER NOT NULL DEFAULT 0,
  title             TEXT NOT NULL,
  why               TEXT,
  path              TEXT[] NOT NULL DEFAULT '{}',
  steps             TEXT[] NOT NULL DEFAULT '{}',
  -- [{ kind: 'warn' | 'stop', title, body }]
  notes             JSONB NOT NULL DEFAULT '[]'::jsonb,
  shot              TEXT,
  super_admin_only  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS manual_pitfalls (
  id         BIGSERIAL PRIMARY KEY,
  role       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  problem    TEXT NOT NULL,
  meaning    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_manual_tasks_role ON manual_tasks (role, position);
CREATE INDEX IF NOT EXISTS idx_manual_pitfalls_role ON manual_pitfalls (role, position);

-- seed: the manual as first written
INSERT INTO manual_intro (role, headline, intro, routine_title, routine_items)
VALUES ('teacher', 'You run the class, and the system records it', ARRAY['Five things belong to you: your own check-in, the children''s register, your teaching plan, test marks, and flagging a child who needs the mentor. Everything else — admitting students, the timetable, stationery — is your centre manager''s.','You cannot admit a student. If a new child arrives, give the details to your centre manager.']::text[], 'Every teaching day', ARRAY['Check in when you reach the centre','Mark the register — the same day','Tick off what you taught','Check out before you leave']::text[])
ON CONFLICT (role) DO NOTHING;
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 0, 'Check in when you arrive', 'The system checks where you are, not just when.', ARRAY['Attendance','My check-in']::text[], ARRAY['Open the page. It says “Reading location…” while your phone or laptop finds you.','Press Check in. If you are inside the centre, it records the time.','Press Check out before you leave. The page then says “Today is complete.”']::text[], '[{"kind":"stop","title":"You must be within 50 metres of the centre","body":"Both to check in and to check out. Standing outside the gate will be refused. If it refuses while you are plainly inside the centre, tell your manager — the centre''s position on the map may not be set correctly yet."}]'::jsonb, 'teacher-checkin', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 1, 'Mark the register', 'One row per child, five buttons each.', ARRAY['Attendance','Student register']::text[], ARRAY['Choose the class and the date. Today''s date is already filled in.','For each child press one button: P present, A absent, L late, H half day, Lv leave.','The counts along the top update as you go, so you can check them against the heads in the room.','Press Save. It tells you how many rows were written.']::text[], '[{"kind":"warn","title":"Present, Late and Half day can only be marked on the day itself","body":"Those three buttons switch off for past dates — you cannot mark a child present for yesterday. Absent and Leave stay available. Any day left unmarked is closed off as absent automatically, so mark the register before you leave."}]'::jsonb, 'teacher-register', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 2, 'Write your teaching plan, seven days ahead', 'Your manager and the mentor both read these.', ARRAY['Teaching','Teaching plans']::text[], ARRAY['Fill the form on the right: a title, the subject, your class, and the dates it runs.','Plans go in at least seven days before they begin, so you cannot pick a date sooner. The earliest allowed date is shown on the form.','Press Create plan, then open it and add your topics one at a time.','Submit the plan to your centre manager when it is ready.']::text[], '[{"kind":"warn","title":"Teaching Hindi? Type in Hindi","body":"When the subject is Hindi the fields open in Hindi automatically. Type “swar aur vyanjan” and press space — it becomes स्वर और व्यंजन. Where a word could be spelled two ways a short list appears; click the one you meant. The अ button switches Hindi typing on and off, and the keyboard button opens a character chart."}]'::jsonb, 'teacher-plan', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 3, 'Record what actually happened', 'This is the part the mentor reads to know which classes need help.', ARRAY['Teaching','Teaching plans','open a plan']::text[], ARRAY['Find the topic you taught and press Mark taught.','Set the status — taught, partly covered, or skipped — and the date.','Fill the three boxes: how the class went, aids and references used, and issues faced.','Press Save.']::text[], '[{"kind":"warn","title":"Be specific in “issues faced”","body":"“Power cut for twenty minutes” or “six children still struggle with unlike denominators” is useful. “Fine” is not. The mentor filters this list to only where an issue was faced, so that box is how you ask for help."}]'::jsonb, 'teacher-remarks', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 4, 'Enter test marks', NULL, ARRAY['Teaching','Tests & marks']::text[], ARRAY['Open the test, or set one up: name it, choose the type, pick your classes, and list the subjects.','Open a subject to get the marks sheet: the whole class on one screen.','Type each child''s marks, or tick absent.','Press Save. Publish the results when you are sure.']::text[], '[{"kind":"warn","title":"Marks decide who moves up","body":"At the end of the year a child whose total reaches the total of the pass marks moves to the next class; one who falls short repeats it. Low marks also put a child on the mentor''s dashboard for a parent meeting. Enter them promptly."}]'::jsonb, 'teacher-marks', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('teacher', 5, 'Flag a child who needs the mentor', 'The fastest route is from the register, while you are looking at the class.', ARRAY['Attendance','Student register','the flag beside the name']::text[], ARRAY['Press the flag next to the child''s name. The referral form opens.','Tick what you have noticed. Tick as many as apply.','Write what you have seen, and what you have already tried.','Set urgency to Urgent if the child should be seen first.','Press Send to mentor.']::text[], '[{"kind":"warn","title":"One open referral per child","body":"If a child already has one open you cannot raise a second. Add to the conversation with the mentor instead; a new one can be raised once the first is closed."}]'::jsonb, 'teacher-flag', FALSE);
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('teacher', 0, '“Check in” is refused', 'You are more than 50 m from the centre — or the centre''s map position has not been set. Tell your manager if you are certain you are inside.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('teacher', 1, 'The P button is greyed out', 'You are looking at a past date. Present, Late and Half day are same-day only.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('teacher', 2, '“Only the centre manager can admit a student”', 'Correct — teachers do not admit children. Pass the details to your manager.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('teacher', 3, 'Cannot pick next week for a teaching plan', 'Plans need seven days'' notice. The earliest date you may choose is shown on the form.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('teacher', 4, 'A child is missing from the register', 'They are not enrolled in that class for this session. Your manager can move them.');
INSERT INTO manual_intro (role, headline, intro, routine_title, routine_items)
VALUES ('center_manager', 'Your centre''s roll, its staff and its stock', ARRAY['You admit children, allot teachers to classes, build the timetable, record stationery, and watch that your registers are actually being filled. Everything you see is your centre only.','Two things are not yours: you cannot open a new centre, and you cannot take a child off the roll. Both belong to an administrator.']::text[], 'Each week', ARRAY['Admit any new children','Check every class filled its register','Approve teaching plans as they arrive','Record stationery given out']::text[])
ON CONFLICT (role) DO NOTHING;
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('center_manager', 0, 'Admit a new child', 'Five steps, and you can stop halfway and come back.', ARRAY['Students','New admission']::text[], ARRAY['Student — name, date of birth and gender are required. Photograph, place of birth, religion, category, blood group and Aadhaar are optional.','Contact — mobile, address, pincode, city and state are required. There is a tick for “WhatsApp is the same as mobile”.','Family — three cards for mother, father and guardian. If an occupation is not in the list, choose Other and type it.','Admission — admission date, class and centre.','Review — read it back, tick the declaration, submit.']::text[], '[{"kind":"warn","title":"Half-finished admissions are kept","body":"Press Save as draft and it waits for you on the New admission page. Useful when a parent has not brought a document."},{"kind":"warn","title":"The enrolment number is issued for you","body":"Something like FP-3-0042 — the prefix, your centre''s code, and the next number at your centre. You never type it."}]'::jsonb, 'manager-admission', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('center_manager', 1, 'Add a teacher and give them classes', NULL, ARRAY['Administration','People','Staff']::text[], ARRAY['Fill the form: name, email, phone, role Teacher, and an initial password of at least eight characters.','Tell the teacher their password. Nobody can read it back afterwards — if it is lost, return here and set a new one.','Go to Administration › People › Class allocation and tick the classes that teacher holds this session.']::text[], '[{"kind":"stop","title":"Allot the classes or nothing works","body":"Until a teacher is allotted a class they cannot set a test for it or write a plan for it. This is the single most common reason a new teacher says “the system will not let me”."}]'::jsonb, 'manager-staff', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('center_manager', 2, 'Build the timetable', NULL, ARRAY['Teaching','Timetable']::text[], ARRAY['Pick the class.','Add a slot: the day, the time, the subject and the teacher.','Repeat across the week. Remove a slot with the cross beside it.']::text[], '[]'::jsonb, 'manager-timetable', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('center_manager', 3, 'Record stationery given to children', NULL, ARRAY['Supplies']::text[], ARRAY['The top of the page shows what your centre has in hand for each item.','Under “Given to students”, choose the child, the item and the quantity.','Stock received from headquarters appears on the same page — check it matches what actually arrived, and raise it with your administrator if not.']::text[], '[]'::jsonb, 'manager-supplies', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('center_manager', 4, 'Check the registers are being filled', 'A day nobody marks becomes a day of absences.', ARRAY['Insights','Reports']::text[], ARRAY['Choose Student attendance summary, and set the dates — the This week and Last month buttons do it for you.','Run it, and look for children whose attendance has dropped sharply.','Press Export to Excel if you need it for a meeting.','Use Student attendance over time, set to Weekly, to see the trend rather than the detail.']::text[], '[]'::jsonb, 'manager-reports', FALSE);
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('center_manager', 0, 'A teacher cannot set a test', 'They have not been allotted that class. Administration › People › Class allocation.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('center_manager', 1, '“That centre is not one of yours”', 'You are trying to touch a record from another centre. Managers see one centre only.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('center_manager', 2, 'You cannot mark a child dropped out', 'Correct — that is an administrator''s decision, and it needs a reason and a date.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('center_manager', 3, 'A whole day shows every child absent', 'Nobody marked that register. If the centre was shut, ask an administrator to put a closure on the calendar and the absences will stop.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('center_manager', 4, 'The admission form will not submit', 'A required field is empty on an earlier step. The message names the step; go back to it.');
INSERT INTO manual_intro (role, headline, intro, routine_title, routine_items)
VALUES ('mentor', 'You work across every centre, on the children who need attention', ARRAY['Parent meetings, follow-ups, counselling referrals, progress reports and what teachers are writing about their classes. You can see every centre, and you are not tied to one.','You do not admit students, mark registers or manage staff. Your dashboard is built to tell you who needs you, without anyone having to send you a message.']::text[], 'Start here each day', ARRAY['Dashboard — who is falling behind','Counselling — new referrals','Follow-ups — anything overdue']::text[])
ON CONFLICT (role) DO NOTHING;
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 0, 'Read your dashboard first', 'Two lists assemble themselves overnight. You do not have to go looking.', ARRAY['Dashboard']::text[], ARRAY['“Falling behind in tests” lists children whose marks are below the pass total — what they scored, what they needed, when they last had a parent meeting, and whether a referral is already open.','Press Arrange PTM on any row to open the meeting form with that child filled in.','The Counselling tile shows what is open, what is urgent, and what nobody has picked up yet.']::text[], '[{"kind":"warn","title":"The list is empty until marks are entered","body":"It is built from test results. If no teacher has entered marks this session there is nothing to measure, and the list will not appear."}]'::jsonb, 'mentor-dashboard', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 1, 'Work a counselling referral', 'A teacher has asked you to sit with a child.', ARRAY['Parents & support','Counselling']::text[], ARRAY['Urgent referrals sort to the top. Each shows the reasons the teacher ticked, what they wrote, the class and centre, and who raised it.','When you take it on, set Move to → Counselling under way and save. The teacher can see it has been picked up.','When it is finished, set Close the referral and write what came of it. The outcome is required — one line is enough.']::text[], '[]'::jsonb, 'mentor-counselling', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 2, 'Record a parent meeting', 'Picking the child fills several fields for you.', ARRAY['Parents & support','PTM interactions']::text[], ARRAY['Choose the learning centre, then the student. Their admission number, grade and test marks fill in by themselves.','Fill the meeting itself: date, your name, mode of interaction, who attended, and how engaged the parent was.','Record the concerns raised and the commitments the parent made.','Set the follow-up: priority, the next date, and who owns it. You can assign it to any teacher, or keep it yourself.','Save.']::text[], '[]'::jsonb, 'mentor-ptm', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 3, 'Keep follow-ups from slipping', NULL, ARRAY['Parents & support','Follow-ups']::text[], ARRAY['Three figures across the top: overdue, due this week, and open in total.','Overdue rows show their date in red.','Reassign anything that is not moving to somebody at the centre.','Close each one out when it is done.']::text[], '[]'::jsonb, 'mentor-followups', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 4, 'Read what teachers are saying', 'The best early warning you have about a class, rather than a child.', ARRAY['Teaching','Teacher remarks']::text[], ARRAY['Every remark a teacher wrote against a topic they taught, newest first.','Set the filter to “Only where an issue was faced” to see the classes that struggled.','Search for a word — a concept, a centre, a resource — to find the pattern.']::text[], '[]'::jsonb, 'mentor-teacher-remarks', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('mentor', 5, 'Print a progress report', NULL, ARRAY['Students','Progress reports']::text[], ARRAY['Filter by class and centre.','Open one child''s report, or press Print all for the whole class.','The printed sheet carries the logo, the centre''s name and address, the child''s photograph, and their marks.']::text[], '[]'::jsonb, 'mentor-progress', FALSE);
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('mentor', 0, '“Falling behind” shows nothing', 'No test marks have been entered this session. There is nothing to measure yet.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('mentor', 1, 'You cannot add a student', 'Correct. Mentors read the roll; centre managers admit children.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('mentor', 2, 'No Flag button on a child''s page', 'Also correct. Teachers raise referrals; you receive and work them.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('mentor', 3, 'A referral will not close', 'The outcome box is empty. Say what came of it, then close.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('mentor', 4, 'A child''s marks are missing on the PTM form', 'None have been entered for them. The rest of the form still works.');
INSERT INTO manual_intro (role, headline, intro, routine_title, routine_items)
VALUES ('admin', 'Every centre, and the decisions nobody else can make', ARRAY['You see all the centres. Four things are yours alone: taking a child off the roll, standing a backup teacher in for an absent one, recording what arrives at headquarters, and watching whether the centres are actually being run.','A Super Admin can additionally open a new centre, change the classes and sessions, set which days of the week are working days, and run the year-end promotion.']::text[], 'Each week', ARRAY['Attendance by centre — who is slipping','Counselling load — anything unpicked','Supplies out to centres','Staff attendance and coverage']::text[])
ON CONFLICT (role) DO NOTHING;
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 0, 'See how every centre is doing', NULL, ARRAY['Insights','Reports']::text[], ARRAY['Choose Student attendance over time, then Daily, Weekly or Monthly.','Leave the centre filter empty to get every centre, one line each.','Read the last two columns: the figure for that period, and the running figure across the whole range.','Export to Excel for a trustee meeting.']::text[], '[{"kind":"warn","title":"Look for a centre far from the others","body":"A centre running well below the rest is usually an operational problem, not a data one — and the report is where you will spot it first."}]'::jsonb, 'admin-trend', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 1, 'Watch the counselling load', NULL, ARRAY['Insights','Reports']::text[], ARRAY['Counselling referrals lists every child referred: the reasons, what the teacher wrote, who has it, and how many days it has been open.','Counselling — reasons and load counts them per centre and per reason, with the average days open.','The dashboard tile shows the same at a glance — open, urgent, and not yet picked up.']::text[], '[{"kind":"warn","title":"Two patterns to watch for","body":"A centre raising far more referrals than the rest, and referrals sitting open for weeks. The first may be a good teacher noticing things; the second is a mentor with too much on. The reasons report separates them."}]'::jsonb, 'admin-counselling', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 2, 'Take a child off the roll', 'Restricted to administrators so a centre cannot quietly drop a child it is measured on.', ARRAY['Students','All students','the child']::text[], ARRAY['Open the child and find the Drop out card.','Choose a reason — moved away, went back to the village, admitted to a government school, started working — or choose Other and write it.','Set the date it happened, and mark them dropped out.','If the child returns, the same card offers “The child came back”.']::text[], '[]'::jsonb, 'admin-dropout', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 3, 'Cover an absent teacher', NULL, ARRAY['Administration','People','Backup cover']::text[], ARRAY['Choose the backup teacher, the centre they are covering, and the dates.','While the cover runs, that teacher can mark the register and work at that centre.']::text[], '[{"kind":"warn","title":"Only administrators assign cover","body":"A centre manager cannot move a backup teacher to their own centre."}]'::jsonb, 'admin-coverage', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 4, 'Record supplies in and out', NULL, ARRAY['Supplies']::text[], ARRAY['Goods received at headquarters — what arrived, from whom, against which invoice.','Then dispatch to a centre, with a challan number.','The centre records what it gives to children, so the chain runs end to end.','Reports: Supplies stock by centre, Goods received at HQ and Dispatched to centres.']::text[], '[]'::jsonb, 'admin-supplies', FALSE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 5, 'Open a centre, and pin it on the map', NULL, ARRAY['Administration','Setup','Centres']::text[], ARRAY['Add the centre with its code, name and address.','Set its latitude and longitude — standing inside the building.','Staff check-in works within 50 metres, so a position even a street away stops every teacher there from checking in.']::text[], '[]'::jsonb, 'admin-centres', TRUE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 6, 'Set the working week', NULL, ARRAY['Administration','Setup','Working days']::text[], ARRAY['Untick a day to make it a weekly holiday at every centre.','It is drawn on the calendar, and the register stops closing itself on that day.','Attendance already recorded is not changed.']::text[], '[]'::jsonb, 'admin-working-days', TRUE);
INSERT INTO manual_tasks (role, position, title, why, path, steps, notes, shot, super_admin_only)
VALUES ('admin', 7, 'Run the year-end promotion', NULL, ARRAY['Students','Promotions']::text[], ARRAY['Open a new session first, under Administration › Setup › Sessions.','The preview shows, per class, how many passed, how many fell short and how many have no marks.','Type PROMOTE in the confirmation box to run it.']::text[], '[{"kind":"stop","title":"A child with no marks moves up","body":"Promotion follows the results: a child whose total reached the total of the pass marks moves up, one who fell short repeats the class, and one with no marks at all moves up because there is nothing to hold them back on. Make sure marks are in before you run it."}]'::jsonb, 'admin-promotions', TRUE);
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('admin', 0, 'Staff cannot check in anywhere', 'The centre has no position on the map, or the wrong one. Set it standing inside the centre — the fence is 50 metres.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('admin', 1, 'A whole centre shows every child absent', 'The register was not filled. If the centre was shut, add a closure to the calendar and the absences stop being counted.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('admin', 2, 'Promotion would move everybody up', 'No marks have been entered, so nothing can be judged. Enter marks first.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('admin', 3, 'You cannot open a new centre', 'That is Super Admin only. Admins maintain existing centres.');
INSERT INTO manual_pitfalls (role, position, problem, meaning)
VALUES ('admin', 4, 'A report comes back empty', 'Usually the date range. The presets — This week, Last month — are the quickest check.');
