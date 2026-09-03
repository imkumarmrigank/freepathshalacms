import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { currentSession, resolveCenterId } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, StatCard } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { fmtDate, fullName, today } from "@/lib/format";
import { eventsBetween } from "@/lib/calendar";
import { EVENT_LABEL, EVENT_TONE } from "@/lib/calendar-meta";
import { isGlobalRole, canAdmitStudents, can } from "@/lib/roles";
import { counsellingLoad, strugglingStudents } from "@/lib/statistics";
import DailyByCentre, { type CentreDay } from "./DailyByCentre";

const ENGAGEMENT_TONE: Record<string, string> = {
  attentive: "ok", neutral: "warn", resistant: "bad",
};

export default async function Dashboard({
  searchParams,
}: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const session = await currentSession();
  const centerId = resolveCenterId(user, null);
  const scope = centerId ? " AND center_id = $2" : "";
  const p = (extra: unknown[] = []) => (centerId ? [...extra, centerId] : extra);

  if (!session) {
    return (
      <Alert kind="warn">
        No academic session is marked as current.{" "}
        {isGlobalRole(user.role)
          ? <Link className="underline" href="/manage/sessions">Create one to get started.</Link>
          : "Ask your administrator to open the new session."}
      </Alert>
    );
  }

  // The mentor's two standing questions: who is behind, and who is waiting.
  // Administrators watch the same numbers, so they load for them too.
  const watchesSupport = user.role === "mentor" || isGlobalRole(user.role)
    || user.role === "center_manager";
  const [behind, counselling] = watchesSupport
    ? await Promise.all([
        strugglingStudents(session.id, centerId, 8),
        counsellingLoad(centerId),
      ])
    : [[], null];

  const [students] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM enrollments WHERE session_id = $1 AND status = 'active'${scope}`,
    p([session.id]),
  );
  const [ptms] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM ptm_interactions
      WHERE date_trunc('month', interaction_date) = date_trunc('month', CURRENT_DATE)
        AND session_id = $1${scope}`,
    p([session.id]),
  );
  const [followUps] = await query<{
    overdue: string; due_today: string; this_week: string; pending: string;
  }>(
    `SELECT count(*) FILTER (WHERE follow_up_date < CURRENT_DATE)  AS overdue,
            count(*) FILTER (WHERE follow_up_date = CURRENT_DATE)  AS due_today,
            count(*) FILTER (WHERE follow_up_date > CURRENT_DATE
                               AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days') AS this_week,
            count(*) AS pending
       FROM ptm_interactions
      WHERE follow_up_required AND follow_up_status = 'pending' AND session_id = $1${scope}`,
    p([session.id]),
  );
  const attToday = await one<{ present: string; total: string }>(
    `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
            count(*) AS total
       FROM student_attendance WHERE att_date = $1 AND session_id = $2
       ${centerId ? "AND center_id = $3" : ""}`,
    centerId ? [today(), session.id, centerId] : [today(), session.id],
  );

  const recent = await query<{
    id: number; first_name: string; last_name: string | null; enrollment_no: string;
    interaction_date: string; parent_present: string; engagement: string; mentor: string | null;
  }>(
    `SELECT i.id, s.first_name, s.last_name, s.enrollment_no, i.interaction_date,
            i.parent_present, i.engagement, u.name AS mentor
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       LEFT JOIN users u ON u.id = i.mentor_id
      WHERE i.session_id = $1 ${centerId ? "AND i.center_id = $2" : ""}
      ORDER BY i.interaction_date DESC, i.id DESC LIMIT 5`,
    p([session.id]),
  );

  const upcoming = await query<{
    id: number; first_name: string; last_name: string | null;
    follow_up_date: string; follow_up_mode: string | null;
  }>(
    `SELECT i.id, s.first_name, s.last_name, i.follow_up_date, i.follow_up_mode
       FROM ptm_interactions i JOIN students s ON s.id = i.student_id
      WHERE i.follow_up_required AND i.follow_up_status = 'pending'
        AND i.session_id = $1 ${centerId ? "AND i.center_id = $2" : ""}
      ORDER BY i.follow_up_date NULLS LAST LIMIT 6`,
    p([session.id]),
  );

  const upcomingEvents = (await eventsBetween(
    today(), `${Number(today().slice(0, 4)) + 1}-12-31`, centerId)).slice(0, 5);

  // The administrator's first question each morning is which centres have not
  // marked their register, so answer it before anything else on the page. The
  // day shown is the last one with any register at all, so a quiet early
  // morning does not read as though every centre had failed to mark.
  const wantsDaily = user.role === "super_admin" || user.role === "admin";
  const dailyDay = wantsDaily
    ? (await one<{ d: string }>(
        `SELECT max(att_date) AS d FROM student_attendance WHERE session_id = $1`,
        [session.id]))?.d ?? today()
    : today();

  const daily: CentreDay[] = wantsDaily
    ? await query<CentreDay>(
        `SELECT ce.id AS center_id, ce.name AS center_name, ce.code AS center_code,
                (SELECT count(*) FROM enrollments e
                   JOIN students s ON s.id = e.student_id
                  WHERE e.center_id = ce.id AND e.session_id = $1
                    AND e.status = 'active' AND s.status = 'active'
                    AND e.enrolled_on <= $2::date)                        AS roll,
                count(a.*) FILTER (WHERE a.att_date = $2::date)           AS marked,
                count(a.*) FILTER (WHERE a.att_date = $2::date
                                     AND a.status IN ('present','late','half_day')) AS present,
                count(a.*) FILTER (WHERE a.att_date = $2::date
                                     AND a.status = 'absent')             AS absent,
                (SELECT count(*) FROM users u
                  WHERE u.center_id = ce.id AND u.is_active
                    AND u.role IN ('teacher','center_manager'))           AS staff,
                (SELECT count(*) FROM staff_attendance sa
                  WHERE sa.center_id = ce.id AND sa.att_date = $2::date
                    AND sa.status IN ('present','late','half_day'))       AS staff_in,
                (SELECT count(*) FROM staff_attendance sa
                  WHERE sa.center_id = ce.id AND sa.att_date = $2::date
                    AND sa.status = 'late')                               AS staff_late
           FROM centers ce
           LEFT JOIN student_attendance a
                  ON a.center_id = ce.id AND a.session_id = $1 AND a.att_date = $2::date
          WHERE ce.is_active
          GROUP BY ce.id, ce.name, ce.code
          ORDER BY ce.code`,
        [session.id, dailyDay])
    : [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const attPct = Number(attToday?.total ?? 0) > 0
    ? Math.round((Number(attToday!.present) / Number(attToday!.total)) * 100) : null;

  return (
    <>
      {denied && <div className="mb-5"><Alert kind="bad">You don’t have access to that page.</Alert></div>}

      {(Number(followUps.overdue) > 0 || Number(followUps.due_today) > 0) && (
        <div className="mb-5">
          <Alert kind={Number(followUps.overdue) > 0 ? "bad" : "warn"}>
            {Number(followUps.overdue) > 0 && (
              <>
                <strong>{followUps.overdue}</strong> follow-up
                {Number(followUps.overdue) === 1 ? " is" : "s are"} past the date promised to the parent
                {Number(followUps.due_today) > 0 && ", and "}
              </>
            )}
            {Number(followUps.due_today) > 0 && (
              <>
                <strong>{followUps.due_today}</strong> {Number(followUps.overdue) > 0 ? "" : "follow-up"}
                {Number(followUps.due_today) === 1 ? " is" : "s are"} due today
              </>
            )}
            .{" "}
            <Link href="/follow-ups" className="font-medium underline">Open follow-ups</Link>
          </Alert>
        </div>
      )}

      <div className="mb-6">
        <div className="label-cap">{greeting}</div>
        <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em]">{user.name}</h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">
          {user.centerName ?? "All centres"} · Session {session.name}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={students.n} hint="enrolled this session" />
        <StatCard label="Attendance today" value={attPct === null ? "—" : `${attPct}%`}
          hint={attToday && Number(attToday.total) > 0
            ? `${attToday.present} of ${attToday.total} marked` : "not marked yet"}
          tone={attPct !== null && attPct < 70 ? "warn" : "default"} />
        <StatCard label="PTMs this month" value={ptms.n}
          hint={new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })} />
        <StatCard
          label="Follow-ups"
          value={followUps.pending}
          hint={
            Number(followUps.overdue) > 0
              ? `${followUps.overdue} overdue · ${followUps.due_today} due today`
              : Number(followUps.due_today) > 0
                ? `${followUps.due_today} due today · ${followUps.this_week} later this week`
                : Number(followUps.this_week) > 0
                  ? `${followUps.this_week} due this week`
                  : "nothing pending"
          }
          tone={
            Number(followUps.overdue) > 0
              ? "bad"
              : Number(followUps.due_today) > 0
                ? "warn"
                : "default"
          }
        />
        {watchesSupport && counselling && Number(counselling.open) > 0 && (
          <StatCard
            label="Counselling"
            value={counselling.open}
            hint={Number(counselling.urgent) > 0
              ? `${counselling.urgent} urgent · ${counselling.waiting} not picked up`
              : `${counselling.waiting} not picked up yet`}
            tone={Number(counselling.urgent) > 0 ? "bad"
              : Number(counselling.waiting) > 0 ? "warn" : "default"} />
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href="/ptm/new" className="btn btn-primary">
          <IconPlus className="h-4 w-4" /> Record Parent Interaction
        </Link>
        <Link href="/ptm" className="btn btn-ghost">View Interaction History</Link>
        {can(user.role, "attendance") && (
          <Link href="/attendance" className="btn btn-ghost">Mark student attendance</Link>
        )}
        {!isGlobalRole(user.role) && (
          <Link href="/my-attendance" className="btn btn-ghost">My check-in</Link>
        )}
        {canAdmitStudents(user.role) && (
          <Link href="/students/new" className="btn btn-ghost">Add student</Link>
        )}
      </div>

      {wantsDaily && (
        <div className="mt-6">
          <DailyByCentre day={dailyDay} rows={daily} />
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <>
          <div className="label-cap mb-2.5 mt-6">On the calendar</div>
          <Card pad={false}>
            <ul className="flex flex-wrap">
              {upcomingEvents.map((e) => (
                <li key={`${e.source}-${e.id}`}
                  className="flex min-w-[220px] flex-1 items-center gap-3 border-b border-[#f1f1f6] px-4 py-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{e.title}</div>
                    <div className="truncate text-[12px] text-[var(--muted)]">
                      {fmtDate(e.start_date)}{e.center_name ? ` · ${e.center_name}` : " · All centres"}
                    </div>
                  </div>
                  <Badge tone={EVENT_TONE[e.event_type]}>
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {watchesSupport && behind.length > 0 && (
        <>
          <div className="label-cap mb-2.5 mt-6">
            Falling behind in tests — worth a parent meeting
          </div>
          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Student</th><th>Class</th>
                    {!centerId && <th>Centre</th>}
                    <th>Scored</th><th>Needed to pass</th><th>Last PTM</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {behind.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/students/${b.id}`}
                          className="font-medium hover:text-[var(--brand)]">
                          {b.student}
                        </Link>
                        {b.flagged && (
                          <Badge tone="warn">Counselling open</Badge>
                        )}
                      </td>
                      <td className="text-[var(--muted)]">{b.class_name ?? "—"}</td>
                      {!centerId && <td className="text-[var(--muted)]">{b.center_name}</td>}
                      <td className="whitespace-nowrap tabular-nums">
                        {Math.round(Number(b.obtained))}
                        <span className="text-[var(--faint)]"> / {Math.round(Number(b.max_marks))}</span>
                        <span className="ml-1.5 text-[var(--bad)]">{b.pct}%</span>
                      </td>
                      <td className="tabular-nums text-[var(--muted)]">
                        {Math.round(Number(b.pass_mark))}
                      </td>
                      <td className="whitespace-nowrap text-[var(--muted)]">
                        {b.last_ptm ? fmtDate(b.last_ptm) : "never"}
                      </td>
                      <td className="text-right">
                        <Link href={`/ptm/new?student=${b.id}`} className="btn btn-ghost btn-sm">
                          Arrange PTM
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="label-cap mb-2.5">Recent interactions</div>
          <Card pad={false}>
            {recent.length === 0
              ? <Empty title="No interactions yet"
                  hint="Parent-teacher conversations you record will show up here."
                  action={
                    <Link href="/ptm/new" className="btn btn-primary btn-sm">
                      <IconPlus className="h-3.5 w-3.5" /> Record Parent Interaction
                    </Link>
                  } />
              : <ul>
                  {recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 border-b border-[#f1f1f6] px-4 py-3 last:border-0">
                      <Avatar name={fullName(r)} size={32} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/ptm/${r.id}`} className="block truncate text-[14px] font-medium hover:text-[var(--brand)]">
                          {fullName(r)}
                        </Link>
                        <div className="truncate text-[12px] text-[var(--muted)]">
                          {fmtDate(r.interaction_date)} · {r.parent_present === "both" ? "Both parents" : r.parent_present}
                        </div>
                      </div>
                      <Badge tone={ENGAGEMENT_TONE[r.engagement]}>
                        {r.engagement[0].toUpperCase() + r.engagement.slice(1)}
                      </Badge>
                    </li>
                  ))}
                </ul>}
          </Card>
        </div>

        <div>
          <div className="label-cap mb-2.5">Upcoming follow-ups</div>
          <Card pad={false}>
            {upcoming.length === 0
              ? <Empty title="Nothing pending" hint="Follow-ups you flag during a PTM appear here." />
              : <ul>
                  {upcoming.map((f) => {
                    const due = f.follow_up_date ? f.follow_up_date.slice(0, 10) : null;
                    const overdue = due !== null && due < today();
                    const dueToday = due === today();
                    return (
                      <li key={f.id} className="flex items-center gap-3 border-b border-[#f1f1f6] px-4 py-3 last:border-0">
                        <span className="h-1.5 w-1.5 flex-none rounded-full"
                          style={{ background: overdue ? "var(--bad)" : dueToday ? "var(--warn)" : "var(--brand)" }} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/ptm/${f.id}`} className="block truncate text-[14px] font-medium hover:text-[var(--brand)]">
                            {fullName(f)}
                          </Link>
                          <div className="text-[12px] capitalize text-[var(--muted)]">
                            {(f.follow_up_mode ?? "follow-up").replace("_", " ")}
                          </div>
                        </div>
                        <span className="flex flex-none items-center gap-2">
                          {overdue && <Badge tone="bad">Overdue</Badge>}
                          {dueToday && <Badge tone="warn">Today</Badge>}
                          <span className={`text-[13px] ${
                            overdue ? "text-[var(--bad)]" : dueToday ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}>
                            {fmtDate(f.follow_up_date)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>}
          </Card>
        </div>
      </div>
    </>
  );
}
