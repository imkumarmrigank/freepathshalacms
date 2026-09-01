# FreePathshala CMS

Student, attendance and parent–teacher management for FreePathshala centres.

Built with Next.js 16 (App Router) + TypeScript + Tailwind, on Neon Postgres, deployed to Render.

---

## What it does

**Centres**
Every student, teacher and record belongs to a centre. A centre has one **manager** and any
number of **teachers**. Each centre carries its own coordinates and a geofence radius, used to
verify staff check-ins.

**Sessions and automatic promotion**
Students are enrolled *per session, per class*. When a new session opens, one promotion run
moves everybody forward:

| Decision on the enrolment | What happens |
|---|---|
| `promote` (default) | Moves to the next class in the ladder |
| `retain` | Repeats the same class in the new session |
| `hold` | Left out of the run entirely — decide later |
| In the class marked **final** | Graduates out of the programme |

The run is idempotent: a student who already has an enrolment in the target session is skipped,
so it is safe to re-run, and safe to run one centre at a time. Every run is recorded in
`promotion_runs`.

**Mid-session admissions**
A student can join any class on any date. If the joining date is after the session start, the
enrolment is tagged `mid_session` — the ladder and the roll are unaffected.

**Enrolment numbers**
Allotted automatically on save, from a per-centre counter locked inside the transaction:

```
FP-C04-0007
│  │   └── running number for that centre
│  └────── centre code
└───────── ENROLLMENT_PREFIX
```

**Student attendance** — marked by teachers, one class at a time.
*Present, late and half-day can only be given on the day itself.* Once a day has passed it is
closed: anyone who was never marked is automatically recorded **absent**, and a closed day can
only be corrected to leave or absent. The close-out runs whenever the attendance page is opened
and again nightly from the cron job. Days marked as a holiday or closure on the calendar are
skipped, per centre.

**Staff attendance** — teachers and managers check themselves in from their phone. The browser's
location is compared against the centre's coordinates; a punch outside the geofence is refused
and the distance is shown. Managers can enter a punch manually with a recorded reason.

**PTM** — schedule meeting days, record each parent conversation (who attended, engagement,
what was discussed, concerns, agreed actions) and flag follow-ups with a date and a mode.
Follow-ups have their own page with overdue tracking.

**School calendar** — holidays, PTM days, exams, feasts and any other event, published by the
super admin (all centres) or a centre manager (their own). Everyone sees it, and scheduled PTM
days appear on the same grid. A holiday or closure also stops that day being auto-marked absent.

**Timetable** — the centre manager builds each class's week: period, time, subject, teacher and
room. One subject per class per period, and a teacher already booked in that period is rejected.
Teachers get a "My week" view of their own periods.

**Teaching plans** — a teacher lists the topics for a class they are allotted, then ticks each
one off as it is taught, recording how the class went, which aids or references were used to
clear doubts, and any issues faced. A plan must be **submitted at least 7 days before it
starts**; once submitted, the centre manager and the super admin can read it.

**Supplies** — the super admin records stationery and other material sent to each centre; the
centre manager records what is handed to each student. Stock in hand is received minus issued,
and an issue larger than the stock is refused inside the transaction.

**Reports** — attendance by class, centre summaries, PTM engagement, and a students CSV export.

## Roles

| Role | Scope |
|---|---|
| `super_admin` | All centres. Centres, sessions, classes, staff, promotions, supplies sent to centres |
| `center_manager` | One centre. Its teachers, class allocation, timetable, students, attendance, PTM, staff register, supplies given to students |
| `teacher` | One centre. Marks student attendance, records PTM, writes teaching plans, own geofenced check-in. **Cannot admit students** |

Scoping is enforced server-side in every action — a non-admin is pinned to their own centre
regardless of what the query string says.

---

## Running locally

```bash
npm install
cp .env.example .env.local     # fill in DATABASE_URL and JWT_SECRET
npm run migrate                # creates the schema
npm run seed                   # classes, sessions, and the super-admin login
npm run dev
```

`npm run seed:demo` additionally creates two sample centres, staff and students.

Scripts read `.env.local` when you pass `node --env-file=.env.local …`; `next dev` picks it up
on its own.

| Script | Purpose |
|---|---|
| `npm run migrate` | Applies `db/migrations/*.sql` once each, tracked in `schema_migrations` |
| `npm run seed` | Class ladder, two sessions, super admin |
| `npm run seed:demo` | Adds sample centres, staff and students |
| `npm run close-register` | Closes unmarked past days (what the cron job calls) |
| `npm run reset` | **Wipes all data.** Needs `CONFIRM_RESET=yes` |

### First login

Seeded as `admin@freepathshala.org` with password `ChangeMe@123` unless you set
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. **Change it immediately after the first sign-in**
(Administration → Staff → Edit).

---

## Deploying to Render

The repo carries a `render.yaml` blueprint: a web service plus a nightly cron job.

1. Render → **New → Blueprint**, point it at this repo.
2. Set `DATABASE_URL` to the Neon **pooled** connection string.
3. Set `APP_URL` on the cron service to the web service's URL.
4. `JWT_SECRET` and `CRON_SECRET` are generated automatically and persist across deploys.

Migrations run from the start command, so a deploy applies any new SQL before the app boots.

### Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `JWT_SECRET` | yes | Signs the session cookie. 32+ random characters |
| `ENROLLMENT_PREFIX` | no | Defaults to `FP` |
| `CRON_SECRET` | no | If set, the close-register endpoint requires it |
| `APP_URL` | cron only | Base URL the cron job calls |

> Geolocation only works over HTTPS (or `localhost`), so staff check-in needs the deployed URL.

---

## Schema

`db/migrations/001_init.sql`

```
centers ──< users (manager_id, teachers)
   │
   ├──< students ──< enrollments >── academic_sessions
   │                     │
   │                     └── class_levels (sequence = promotion ladder)
   │
   ├──< student_attendance      (one row per student per day)
   ├──< staff_attendance        (one row per staff member per day, geofenced)
   ├──< calendar_events         (holidays / PTM / exams / events)
   ├──< timetable_slots         (class × day × period → subject + teacher)
   ├──< teacher_classes         (which classes a teacher holds this session)
   ├──< teaching_plans ──< teaching_plan_topics
   ├──< center_supply_receipts ─┐
   │                            ├─ stock in hand = received − issued
   └──< student_supply_issues ──┘
        ptm_meetings ──< ptm_interactions ──> follow-ups
```

Two notes that matter when you add queries:

- `BIGINT` ids and `DATE` columns are given custom parsers in `src/lib/db.ts` so ids compare as
  numbers and dates stay `YYYY-MM-DD` strings. Without them, id comparisons and date comparisons
  both fail silently.
- Adding a migration means dropping a new numbered `.sql` file into `db/migrations/`. Never edit
  one that has already been applied.

Two Next.js rules that bite quietly here, both learned the hard way:

- A `"use server"` file may export **only async functions**. Shared constants live in
  `src/lib/*-meta.ts` (`plan-meta`, `calendar-meta`, `timetable-meta`), never beside the actions.
- A `"use client"` module's exports are client references. A server component cannot import a
  plain value from one — that is what the `*-meta` modules are for.
