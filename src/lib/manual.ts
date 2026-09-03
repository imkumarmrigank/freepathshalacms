import type { Role } from "./roles";

/**
 * The staff handbook, as data.
 *
 * Written per role rather than as one document with role sections, because a
 * teacher reading "this part does not apply to you" four times learns to skim.
 * Everyone sees only their own.
 *
 * A `shot` names a screenshot in /public/manual. Steps render it underneath
 * when one exists and read perfectly well without, so the manual is useful
 * before every screen has been captured.
 *
 * Shared by server and client — nothing server-only in here.
 */

export type Note = { kind: "warn" | "stop"; title: string; body: string };

export type Task = {
  title: string;
  /** One line on why this matters, above the steps. */
  why?: string;
  /** The menu path, as the sidebar reads it. */
  path?: string[];
  steps: string[];
  notes?: Note[];
  /** File name under /manual, without the extension. */
  shot?: string;
  /** Shown with a "Super Admin only" mark. */
  superAdminOnly?: boolean;
};

export type Manual = {
  label: string;
  headline: string;
  intro: string[];
  routine: { title: string; items: string[] };
  tasks: Task[];
  pitfalls: [problem: string, meaning: string][];
};

/* ------------------------------------------------------------------ teacher */

const TEACHER: Manual = {
  label: "Teacher",
  headline: "You run the class, and the system records it",
  intro: [
    "Five things belong to you: your own check-in, the children's register, your teaching "
      + "plan, test marks, and flagging a child who needs the mentor. Everything else — "
      + "admitting students, the timetable, stationery — is your centre manager's.",
    "You cannot admit a student. If a new child arrives, give the details to your centre "
      + "manager.",
  ],
  routine: {
    title: "Every teaching day",
    items: [
      "Check in when you reach the centre",
      "Mark the register — the same day",
      "Tick off what you taught",
      "Check out before you leave",
    ],
  },
  tasks: [
    {
      title: "Check in when you arrive",
      why: "The system checks where you are, not just when.",
      path: ["Attendance", "My check-in"],
      shot: "teacher-checkin",
      steps: [
        "Open the page. It says “Reading location…” while your phone or laptop finds you.",
        "Press Check in. If you are inside the centre, it records the time.",
        "Press Check out before you leave. The page then says “Today is complete.”",
      ],
      notes: [{
        kind: "stop",
        title: "You must be within 50 metres of the centre",
        body: "Both to check in and to check out. Standing outside the gate will be refused. "
          + "If it refuses while you are plainly inside the centre, tell your manager — the "
          + "centre's position on the map may not be set correctly yet.",
      }],
    },
    {
      title: "Mark the register",
      why: "One row per child, five buttons each.",
      path: ["Attendance", "Student register"],
      shot: "teacher-register",
      steps: [
        "Choose the class and the date. Today's date is already filled in.",
        "For each child press one button: P present, A absent, L late, H half day, Lv leave.",
        "The counts along the top update as you go, so you can check them against the heads "
          + "in the room.",
        "Press Save. It tells you how many rows were written.",
      ],
      notes: [{
        kind: "warn",
        title: "Present, Late and Half day can only be marked on the day itself",
        body: "Those three buttons switch off for past dates — you cannot mark a child present "
          + "for yesterday. Absent and Leave stay available. Any day left unmarked is closed "
          + "off as absent automatically, so mark the register before you leave.",
      }],
    },
    {
      title: "Write your teaching plan, seven days ahead",
      why: "Your manager and the mentor both read these.",
      path: ["Teaching", "Teaching plans"],
      shot: "teacher-plan",
      steps: [
        "Fill the form on the right: a title, the subject, your class, and the dates it runs.",
        "Plans go in at least seven days before they begin, so you cannot pick a date sooner. "
          + "The earliest allowed date is shown on the form.",
        "Press Create plan, then open it and add your topics one at a time.",
        "Submit the plan to your centre manager when it is ready.",
      ],
      notes: [{
        kind: "warn",
        title: "Teaching Hindi? Type in Hindi",
        body: "When the subject is Hindi the fields open in Hindi automatically. Type "
          + "“swar aur vyanjan” and press space — it becomes स्वर और व्यंजन. Where a word "
          + "could be spelled two ways a short list appears; click the one you meant. The अ "
          + "button switches Hindi typing on and off, and the keyboard button opens a "
          + "character chart.",
      }],
    },
    {
      title: "Record what actually happened",
      why: "This is the part the mentor reads to know which classes need help.",
      path: ["Teaching", "Teaching plans", "open a plan"],
      shot: "teacher-remarks",
      steps: [
        "Find the topic you taught and press Mark taught.",
        "Set the status — taught, partly covered, or skipped — and the date.",
        "Fill the three boxes: how the class went, aids and references used, and issues faced.",
        "Press Save.",
      ],
      notes: [{
        kind: "warn",
        title: "Be specific in “issues faced”",
        body: "“Power cut for twenty minutes” or “six children still struggle with unlike "
          + "denominators” is useful. “Fine” is not. The mentor filters this list to only "
          + "where an issue was faced, so that box is how you ask for help.",
      }],
    },
    {
      title: "Enter test marks",
      path: ["Teaching", "Tests & marks"],
      shot: "teacher-marks",
      steps: [
        "Open the test, or set one up: name it, choose the type, pick your classes, and list "
          + "the subjects.",
        "Open a subject to get the marks sheet: the whole class on one screen.",
        "Type each child's marks, or tick absent.",
        "Press Save. Publish the results when you are sure.",
      ],
      notes: [{
        kind: "warn",
        title: "Marks decide who moves up",
        body: "At the end of the year a child whose total reaches the total of the pass marks "
          + "moves to the next class; one who falls short repeats it. Low marks also put a "
          + "child on the mentor's dashboard for a parent meeting. Enter them promptly.",
      }],
    },
    {
      title: "Flag a child who needs the mentor",
      why: "The fastest route is from the register, while you are looking at the class.",
      path: ["Attendance", "Student register", "the flag beside the name"],
      shot: "teacher-flag",
      steps: [
        "Press the flag next to the child's name. The referral form opens.",
        "Tick what you have noticed. Tick as many as apply.",
        "Write what you have seen, and what you have already tried.",
        "Set urgency to Urgent if the child should be seen first.",
        "Press Send to mentor.",
      ],
      notes: [{
        kind: "warn",
        title: "One open referral per child",
        body: "If a child already has one open you cannot raise a second. Add to the "
          + "conversation with the mentor instead; a new one can be raised once the first "
          + "is closed.",
      }],
    },
  ],
  pitfalls: [
    ["“Check in” is refused",
      "You are more than 50 m from the centre — or the centre's map position has not been set. "
      + "Tell your manager if you are certain you are inside."],
    ["The P button is greyed out",
      "You are looking at a past date. Present, Late and Half day are same-day only."],
    ["“Only the centre manager can admit a student”",
      "Correct — teachers do not admit children. Pass the details to your manager."],
    ["Cannot pick next week for a teaching plan",
      "Plans need seven days' notice. The earliest date you may choose is shown on the form."],
    ["A child is missing from the register",
      "They are not enrolled in that class for this session. Your manager can move them."],
  ],
};

/* ----------------------------------------------------------- centre manager */

const MANAGER: Manual = {
  label: "Centre Manager",
  headline: "Your centre's roll, its staff and its stock",
  intro: [
    "You admit children, allot teachers to classes, build the timetable, record stationery, "
      + "and watch that your registers are actually being filled. Everything you see is your "
      + "centre only.",
    "Two things are not yours: you cannot open a new centre, and you cannot take a child off "
      + "the roll. Both belong to an administrator.",
  ],
  routine: {
    title: "Each week",
    items: [
      "Admit any new children",
      "Check every class filled its register",
      "Approve teaching plans as they arrive",
      "Record stationery given out",
    ],
  },
  tasks: [
    {
      title: "Admit a new child",
      why: "Five steps, and you can stop halfway and come back.",
      path: ["Students", "New admission"],
      shot: "manager-admission",
      steps: [
        "Student — name, date of birth and gender are required. Photograph, place of birth, "
          + "religion, category, blood group and Aadhaar are optional.",
        "Contact — mobile, address, pincode, city and state are required. There is a tick for "
          + "“WhatsApp is the same as mobile”.",
        "Family — three cards for mother, father and guardian. If an occupation is not in the "
          + "list, choose Other and type it.",
        "Admission — admission date, class and centre.",
        "Review — read it back, tick the declaration, submit.",
      ],
      notes: [
        {
          kind: "warn",
          title: "Half-finished admissions are kept",
          body: "Press Save as draft and it waits for you on the New admission page. Useful "
            + "when a parent has not brought a document.",
        },
        {
          kind: "warn",
          title: "The enrolment number is issued for you",
          body: "Something like FP-3-0042 — the prefix, your centre's code, and the next "
            + "number at your centre. You never type it.",
        },
      ],
    },
    {
      title: "Add a teacher and give them classes",
      path: ["Administration", "People", "Staff"],
      shot: "manager-staff",
      steps: [
        "Fill the form: name, email, phone, role Teacher, and an initial password of at least "
          + "eight characters.",
        "Tell the teacher their password. Nobody can read it back afterwards — if it is lost, "
          + "return here and set a new one.",
        "Go to Administration › People › Class allocation and tick the classes that teacher "
          + "holds this session.",
      ],
      notes: [{
        kind: "stop",
        title: "Allot the classes or nothing works",
        body: "Until a teacher is allotted a class they cannot set a test for it or write a "
          + "plan for it. This is the single most common reason a new teacher says “the "
          + "system will not let me”.",
      }],
    },
    {
      title: "Build the timetable",
      path: ["Teaching", "Timetable"],
      shot: "manager-timetable",
      steps: [
        "Pick the class.",
        "Add a slot: the day, the time, the subject and the teacher.",
        "Repeat across the week. Remove a slot with the cross beside it.",
      ],
    },
    {
      title: "Record stationery given to children",
      path: ["Supplies"],
      shot: "manager-supplies",
      steps: [
        "The top of the page shows what your centre has in hand for each item.",
        "Under “Given to students”, choose the child, the item and the quantity.",
        "Stock received from headquarters appears on the same page — check it matches what "
          + "actually arrived, and raise it with your administrator if not.",
      ],
    },
    {
      title: "Check the registers are being filled",
      why: "A day nobody marks becomes a day of absences.",
      path: ["Insights", "Reports"],
      shot: "manager-reports",
      steps: [
        "Choose Student attendance summary, and set the dates — the This week and Last month "
          + "buttons do it for you.",
        "Run it, and look for children whose attendance has dropped sharply.",
        "Press Export to Excel if you need it for a meeting.",
        "Use Student attendance over time, set to Weekly, to see the trend rather than the "
          + "detail.",
      ],
    },
  ],
  pitfalls: [
    ["A teacher cannot set a test",
      "They have not been allotted that class. Administration › People › Class allocation."],
    ["“That centre is not one of yours”",
      "You are trying to touch a record from another centre. Managers see one centre only."],
    ["You cannot mark a child dropped out",
      "Correct — that is an administrator's decision, and it needs a reason and a date."],
    ["A whole day shows every child absent",
      "Nobody marked that register. If the centre was shut, ask an administrator to put a "
      + "closure on the calendar and the absences will stop."],
    ["The admission form will not submit",
      "A required field is empty on an earlier step. The message names the step; go back to it."],
  ],
};

/* ------------------------------------------------------------------- mentor */

const MENTOR: Manual = {
  label: "Mentor",
  headline: "You work across every centre, on the children who need attention",
  intro: [
    "Parent meetings, follow-ups, counselling referrals, progress reports and what teachers "
      + "are writing about their classes. You can see every centre, and you are not tied to one.",
    "You do not admit students, mark registers or manage staff. Your dashboard is built to "
      + "tell you who needs you, without anyone having to send you a message.",
  ],
  routine: {
    title: "Start here each day",
    items: [
      "Dashboard — who is falling behind",
      "Counselling — new referrals",
      "Follow-ups — anything overdue",
    ],
  },
  tasks: [
    {
      title: "Read your dashboard first",
      why: "Two lists assemble themselves overnight. You do not have to go looking.",
      path: ["Dashboard"],
      shot: "mentor-dashboard",
      steps: [
        "“Falling behind in tests” lists children whose marks are below the pass total — what "
          + "they scored, what they needed, when they last had a parent meeting, and whether "
          + "a referral is already open.",
        "Press Arrange PTM on any row to open the meeting form with that child filled in.",
        "The Counselling tile shows what is open, what is urgent, and what nobody has picked "
          + "up yet.",
      ],
      notes: [{
        kind: "warn",
        title: "The list is empty until marks are entered",
        body: "It is built from test results. If no teacher has entered marks this session "
          + "there is nothing to measure, and the list will not appear.",
      }],
    },
    {
      title: "Work a counselling referral",
      why: "A teacher has asked you to sit with a child.",
      path: ["Parents & support", "Counselling"],
      shot: "mentor-counselling",
      steps: [
        "Urgent referrals sort to the top. Each shows the reasons the teacher ticked, what "
          + "they wrote, the class and centre, and who raised it.",
        "When you take it on, set Move to → Counselling under way and save. The teacher can "
          + "see it has been picked up.",
        "When it is finished, set Close the referral and write what came of it. The outcome "
          + "is required — one line is enough.",
      ],
    },
    {
      title: "Record a parent meeting",
      why: "Picking the child fills several fields for you.",
      path: ["Parents & support", "PTM interactions"],
      shot: "mentor-ptm",
      steps: [
        "Choose the learning centre, then the student. Their admission number, grade and test "
          + "marks fill in by themselves.",
        "Fill the meeting itself: date, your name, mode of interaction, who attended, and how "
          + "engaged the parent was.",
        "Record the concerns raised and the commitments the parent made.",
        "Set the follow-up: priority, the next date, and who owns it. You can assign it to any "
          + "teacher, or keep it yourself.",
        "Save.",
      ],
    },
    {
      title: "Keep follow-ups from slipping",
      path: ["Parents & support", "Follow-ups"],
      shot: "mentor-followups",
      steps: [
        "Three figures across the top: overdue, due this week, and open in total.",
        "Overdue rows show their date in red.",
        "Reassign anything that is not moving to somebody at the centre.",
        "Close each one out when it is done.",
      ],
    },
    {
      title: "Read what teachers are saying",
      why: "The best early warning you have about a class, rather than a child.",
      path: ["Teaching", "Teacher remarks"],
      shot: "mentor-teacher-remarks",
      steps: [
        "Every remark a teacher wrote against a topic they taught, newest first.",
        "Set the filter to “Only where an issue was faced” to see the classes that struggled.",
        "Search for a word — a concept, a centre, a resource — to find the pattern.",
      ],
    },
    {
      title: "Print a progress report",
      path: ["Students", "Progress reports"],
      shot: "mentor-progress",
      steps: [
        "Filter by class and centre.",
        "Open one child's report, or press Print all for the whole class.",
        "The printed sheet carries the logo, the centre's name and address, the child's "
          + "photograph, and their marks.",
      ],
    },
  ],
  pitfalls: [
    ["“Falling behind” shows nothing",
      "No test marks have been entered this session. There is nothing to measure yet."],
    ["You cannot add a student",
      "Correct. Mentors read the roll; centre managers admit children."],
    ["No Flag button on a child's page",
      "Also correct. Teachers raise referrals; you receive and work them."],
    ["A referral will not close",
      "The outcome box is empty. Say what came of it, then close."],
    ["A child's marks are missing on the PTM form",
      "None have been entered for them. The rest of the form still works."],
  ],
};

/* -------------------------------------------------------------------- admin */

const ADMIN: Manual = {
  label: "Administrator",
  headline: "Every centre, and the decisions nobody else can make",
  intro: [
    "You see all the centres. Four things are yours alone: taking a child off the roll, "
      + "standing a backup teacher in for an absent one, recording what arrives at "
      + "headquarters, and watching whether the centres are actually being run.",
    "A Super Admin can additionally open a new centre, change the classes and sessions, set "
      + "which days of the week are working days, and run the year-end promotion.",
  ],
  routine: {
    title: "Each week",
    items: [
      "Attendance by centre — who is slipping",
      "Counselling load — anything unpicked",
      "Supplies out to centres",
      "Staff attendance and coverage",
    ],
  },
  tasks: [
    {
      title: "See how every centre is doing",
      path: ["Insights", "Reports"],
      shot: "admin-trend",
      steps: [
        "Choose Student attendance over time, then Daily, Weekly or Monthly.",
        "Leave the centre filter empty to get every centre, one line each.",
        "Read the last two columns: the figure for that period, and the running figure across "
          + "the whole range.",
        "Export to Excel for a trustee meeting.",
      ],
      notes: [{
        kind: "warn",
        title: "Look for a centre far from the others",
        body: "A centre running well below the rest is usually an operational problem, not a "
          + "data one — and the report is where you will spot it first.",
      }],
    },
    {
      title: "Watch the counselling load",
      path: ["Insights", "Reports"],
      shot: "admin-counselling",
      steps: [
        "Counselling referrals lists every child referred: the reasons, what the teacher "
          + "wrote, who has it, and how many days it has been open.",
        "Counselling — reasons and load counts them per centre and per reason, with the "
          + "average days open.",
        "The dashboard tile shows the same at a glance — open, urgent, and not yet picked up.",
      ],
      notes: [{
        kind: "warn",
        title: "Two patterns to watch for",
        body: "A centre raising far more referrals than the rest, and referrals sitting open "
          + "for weeks. The first may be a good teacher noticing things; the second is a "
          + "mentor with too much on. The reasons report separates them.",
      }],
    },
    {
      title: "Take a child off the roll",
      why: "Restricted to administrators so a centre cannot quietly drop a child it is "
        + "measured on.",
      path: ["Students", "All students", "the child"],
      shot: "admin-dropout",
      steps: [
        "Open the child and find the Drop out card.",
        "Choose a reason — moved away, went back to the village, admitted to a government "
          + "school, started working — or choose Other and write it.",
        "Set the date it happened, and mark them dropped out.",
        "If the child returns, the same card offers “The child came back”.",
      ],
    },
    {
      title: "Cover an absent teacher",
      path: ["Administration", "People", "Backup cover"],
      shot: "admin-coverage",
      steps: [
        "Choose the backup teacher, the centre they are covering, and the dates.",
        "While the cover runs, that teacher can mark the register and work at that centre.",
      ],
      notes: [{
        kind: "warn",
        title: "Only administrators assign cover",
        body: "A centre manager cannot move a backup teacher to their own centre.",
      }],
    },
    {
      title: "Record supplies in and out",
      path: ["Supplies"],
      shot: "admin-supplies",
      steps: [
        "Goods received at headquarters — what arrived, from whom, against which invoice.",
        "Then dispatch to a centre, with a challan number.",
        "The centre records what it gives to children, so the chain runs end to end.",
        "Reports: Supplies stock by centre, Goods received at HQ and Dispatched to centres.",
      ],
    },
    {
      title: "Open a centre, and pin it on the map",
      superAdminOnly: true,
      path: ["Administration", "Setup", "Centres"],
      shot: "admin-centres",
      steps: [
        "Add the centre with its code, name and address.",
        "Set its latitude and longitude — standing inside the building.",
        "Staff check-in works within 50 metres, so a position even a street away stops every "
          + "teacher there from checking in.",
      ],
    },
    {
      title: "Set the working week",
      superAdminOnly: true,
      path: ["Administration", "Setup", "Working days"],
      shot: "admin-working-days",
      steps: [
        "Untick a day to make it a weekly holiday at every centre.",
        "It is drawn on the calendar, and the register stops closing itself on that day.",
        "Attendance already recorded is not changed.",
      ],
    },
    {
      title: "Run the year-end promotion",
      superAdminOnly: true,
      path: ["Students", "Promotions"],
      shot: "admin-promotions",
      steps: [
        "Open a new session first, under Administration › Setup › Sessions.",
        "The preview shows, per class, how many passed, how many fell short and how many have "
          + "no marks.",
        "Type PROMOTE in the confirmation box to run it.",
      ],
      notes: [{
        kind: "stop",
        title: "A child with no marks moves up",
        body: "Promotion follows the results: a child whose total reached the total of the "
          + "pass marks moves up, one who fell short repeats the class, and one with no marks "
          + "at all moves up because there is nothing to hold them back on. Make sure marks "
          + "are in before you run it.",
      }],
    },
  ],
  pitfalls: [
    ["Staff cannot check in anywhere",
      "The centre has no position on the map, or the wrong one. Set it standing inside the "
      + "centre — the fence is 50 metres."],
    ["A whole centre shows every child absent",
      "The register was not filled. If the centre was shut, add a closure to the calendar and "
      + "the absences stop being counted."],
    ["Promotion would move everybody up",
      "No marks have been entered, so nothing can be judged. Enter marks first."],
    ["You cannot open a new centre",
      "That is Super Admin only. Admins maintain existing centres."],
    ["A report comes back empty",
      "Usually the date range. The presets — This week, Last month — are the quickest check."],
  ],
};

export const MANUALS: Record<Role, Manual> = {
  teacher: TEACHER,
  backup_teacher: TEACHER,
  center_manager: MANAGER,
  mentor: MENTOR,
  admin: ADMIN,
  super_admin: ADMIN,
};

export function manualFor(role: Role): Manual {
  return MANUALS[role];
}
