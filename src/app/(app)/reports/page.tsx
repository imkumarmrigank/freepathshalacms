import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listSessions, resolveCenterId } from "@/lib/queries";
import { Alert, Card, Empty, Meter, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate } from "@/lib/format";

export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, sessions, cur] = await Promise.all([
    centersForUser(user), listSessions(), currentSession(),
  ]);
  if (!cur && sessions.length === 0)
    return <Alert kind="warn">No academic session exists yet.</Alert>;

  const sessionId = Number(sp.session) || cur?.id || sessions[0]?.id;
  const centerId = resolveCenterId(user, sp.center);
  const from = sp.from || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
  const to = sp.to || new Date().toISOString().slice(0, 10);

  const p: unknown[] = [sessionId];
  let scope = "";
  if (centerId) { p.push(centerId); scope = ` AND center_id = $${p.length}`; }

  const [byClass, byCenter, attendance, ptmStats] = await Promise.all([
    query<{ class_name: string; students: string; present: string; marked: string }>(
      `SELECT cl.name AS class_name, count(DISTINCT e.student_id) AS students,
              count(a.*) FILTER (WHERE a.status IN ('present','late','half_day')) AS present,
              count(a.*) FILTER (WHERE a.status <> 'holiday') AS marked
         FROM enrollments e
         JOIN class_levels cl ON cl.id = e.class_level_id
         LEFT JOIN student_attendance a
           ON a.enrollment_id = e.id AND a.att_date BETWEEN $2 AND $3
        WHERE e.session_id = $1 AND e.status = 'active'
          ${centerId ? `AND e.center_id = $4` : ""}
        GROUP BY cl.name, cl.sequence ORDER BY cl.sequence`,
      centerId ? [sessionId, from, to, centerId] : [sessionId, from, to],
    ),
    query<{ center_name: string; students: string; teachers: string; interactions: string }>(
      `SELECT c.name AS center_name,
              (SELECT count(*) FROM enrollments e
                WHERE e.center_id = c.id AND e.session_id = $1 AND e.status = 'active') AS students,
              (SELECT count(*) FROM users u WHERE u.center_id = c.id AND u.is_active) AS teachers,
              (SELECT count(*) FROM ptm_interactions i
                WHERE i.center_id = c.id AND i.session_id = $1) AS interactions
         FROM centers c WHERE c.is_active ${centerId ? "AND c.id = $2" : ""}
        ORDER BY c.code`,
      centerId ? [sessionId, centerId] : [sessionId],
    ),
    query<{ present: string; marked: string; days: string }>(
      `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
              count(*) FILTER (WHERE status <> 'holiday') AS marked,
              count(DISTINCT att_date) AS days
         FROM student_attendance
        WHERE session_id = $1 AND att_date BETWEEN $2 AND $3
          ${centerId ? "AND center_id = $4" : ""}`,
      centerId ? [sessionId, from, to, centerId] : [sessionId, from, to],
    ),
    query<{ total: string; attentive: string; resistant: string; pending: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE engagement = 'attentive') AS attentive,
              count(*) FILTER (WHERE engagement = 'resistant') AS resistant,
              count(*) FILTER (WHERE follow_up_required AND follow_up_status = 'pending') AS pending
         FROM ptm_interactions WHERE session_id = $1 ${scope}`,
      p,
    ),
  ]);

  const att = attendance[0];
  const overall = Number(att?.marked ?? 0) > 0
    ? (Number(att.present) / Number(att.marked)) * 100 : null;
  const ptm = ptmStats[0];

  return (
    <>
      <PageHeader title="Reports"
        subtitle={`Attendance and PTM activity between ${fmtDate(from)} and ${fmtDate(to)}`}
        right={
          <Link className="btn btn-ghost"
            href={`/api/reports/students.csv?session=${sessionId}${centerId ? `&center=${centerId}` : ""}`}>
            Download students CSV
          </Link>
        } />

      <Filters
        centers={user.role === "super_admin" ? centers : []}
        sessions={sessions}
        current={{ ...sp, session: String(sessionId) }}
      />
      <form className="mt-3 flex flex-wrap items-end gap-2">
        <label>
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">From</span>
          <input className="input" type="date" name="from" defaultValue={from} />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">To</span>
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <input type="hidden" name="session" value={sessionId} />
        {sp.center && <input type="hidden" name="center" value={sp.center} />}
        <button className="btn btn-ghost mb-[1px] h-[38px]" type="submit">Apply</button>
      </form>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overall attendance" value={overall === null ? "—" : `${Math.round(overall)}%`}
          hint={`${att?.days ?? 0} days marked`}
          tone={overall !== null && overall < 70 ? "warn" : "default"} />
        <StatCard label="PTM interactions" value={ptm?.total ?? 0} hint="this session" />
        <StatCard label="Attentive parents" value={ptm?.attentive ?? 0} hint="of all interactions" tone="ok" />
        <StatCard label="Pending follow-ups" value={ptm?.pending ?? 0} hint="still open"
          tone={Number(ptm?.pending ?? 0) > 0 ? "bad" : "default"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="label-cap mb-2.5">Attendance by class</div>
          <Card pad={false}>
            {byClass.length === 0 ? <Empty title="No enrolments in this session" /> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Class</th><th>Students</th><th>Attendance</th></tr></thead>
                  <tbody>
                    {byClass.map((r) => {
                      const v = Number(r.marked) > 0 ? (Number(r.present) / Number(r.marked)) * 100 : null;
                      return (
                        <tr key={r.class_name}>
                          <td className="font-medium">{r.class_name}</td>
                          <td className="tabular-nums">{r.students}</td>
                          <td>{v === null ? <span className="text-[var(--faint)]">Not marked</span> : <Meter value={v} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <div className="label-cap mb-2.5">Centre summary</div>
          <Card pad={false}>
            {byCenter.length === 0 ? <Empty title="No centres" /> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Centre</th><th>Students</th><th>Staff</th><th>PTMs</th></tr></thead>
                  <tbody>
                    {byCenter.map((r) => (
                      <tr key={r.center_name}>
                        <td className="font-medium">{r.center_name}</td>
                        <td className="tabular-nums">{r.students}</td>
                        <td className="tabular-nums">{r.teachers}</td>
                        <td className="tabular-nums">{r.interactions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
