import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { currentSession, resolveCenterId } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, StatCard } from "@/components/ui";
import { fmtDate, fullName, today } from "@/lib/format";
import { eventsBetween } from "@/lib/calendar";
import { EVENT_LABEL, EVENT_TONE } from "@/lib/calendar-meta";

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
        {user.role === "super_admin"
          ? <Link className="underline" href="/manage/sessions">Create one to get started.</Link>
          : "Ask your administrator to open the new session."}
      </Alert>
    );
  }

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
  const [followUps] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM ptm_interactions
      WHERE follow_up_required AND follow_up_status = 'pending'
        AND follow_up_date <= CURRENT_DATE + INTERVAL '7 days' AND session_id = $1${scope}`,
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
      ORDER BY i.follow_up_date NULLS LAST LIMIT 5`,
    p([session.id]),
  );

  const upcomingEvents = (await eventsBetween(
    today(), `${Number(today().slice(0, 4)) + 1}-12-31`, centerId)).slice(0, 5);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const attPct = Number(attToday?.total ?? 0) > 0
    ? Math.round((Number(attToday!.present) / Number(attToday!.total)) * 100) : null;

  return (
    <>
      {denied && <div className="mb-5"><Alert kind="bad">You don’t have access to that page.</Alert></div>}

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
        <StatCard label="Follow-ups due" value={followUps.n} hint="next 7 days"
          tone={Number(followUps.n) > 0 ? "bad" : "default"} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href="/attendance" className="btn btn-primary">Mark student attendance</Link>
        <Link href="/ptm/new" className="btn btn-ghost">Record parent interaction</Link>
        {user.role !== "super_admin" && (
          <Link href="/my-attendance" className="btn btn-ghost">My check-in</Link>
        )}
        {user.role !== "teacher" && (
          <Link href="/students/new" className="btn btn-ghost">Add student</Link>
        )}
      </div>

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

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="label-cap mb-2.5">Recent interactions</div>
          <Card pad={false}>
            {recent.length === 0
              ? <Empty title="No interactions yet"
                  hint="Parent-teacher conversations you record will show up here."
                  action={<Link href="/ptm/new" className="btn btn-primary btn-sm">Record one</Link>} />
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
                    const overdue = f.follow_up_date && f.follow_up_date.slice(0, 10) < today();
                    return (
                      <li key={f.id} className="flex items-center gap-3 border-b border-[#f1f1f6] px-4 py-3 last:border-0">
                        <span className="h-1.5 w-1.5 flex-none rounded-full"
                          style={{ background: overdue ? "var(--bad)" : "var(--warn)" }} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/ptm/${f.id}`} className="block truncate text-[14px] font-medium hover:text-[var(--brand)]">
                            {fullName(f)}
                          </Link>
                          <div className="text-[12px] capitalize text-[var(--muted)]">
                            {(f.follow_up_mode ?? "follow-up").replace("_", " ")}
                          </div>
                        </div>
                        <span className={`text-[13px] ${overdue ? "text-[var(--bad)]" : "text-[var(--muted)]"}`}>
                          {fmtDate(f.follow_up_date)}
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
