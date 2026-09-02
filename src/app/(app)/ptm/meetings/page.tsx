import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/format";
import ScheduleForm from "./ScheduleForm";
import { isGlobalRole, isTeaching } from "@/lib/roles";

export default async function MeetingsPage() {
  const user = await requireUser();
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;
  const centerId = resolveCenterId(user, null);

  const meetings = await query<{
    id: number; title: string; meeting_date: string; start_time: string | null;
    end_time: string | null; mode: string; status: string; class_name: string | null;
    center_name: string; recorded: string;
  }>(
    `SELECT m.id, m.title, m.meeting_date, m.start_time, m.end_time, m.mode, m.status,
            cl.name AS class_name, ce.name AS center_name,
            (SELECT count(*) FROM ptm_interactions i WHERE i.meeting_id = m.id) AS recorded
       FROM ptm_meetings m
       JOIN centers ce ON ce.id = m.center_id
       LEFT JOIN class_levels cl ON cl.id = m.class_level_id
      WHERE m.session_id = $1 ${centerId ? "AND m.center_id = $2" : ""}
      ORDER BY m.meeting_date DESC`,
    centerId ? [session.id, centerId] : [session.id],
  );

  return (
    <>
      <PageHeader title="Scheduled PTMs" subtitle={`Session ${session.name}`}
        back={{ href: "/ptm", label: "PTM interactions" }} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card pad={false}>
            {meetings.length === 0 ? (
              <Empty title="No PTMs scheduled"
                hint="Schedule a PTM day so mentors can log each parent conversation against it." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Title</th><th>Class</th>
                      {!centerId && <th>Centre</th>}
                      <th>Recorded</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {meetings.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap font-medium">
                          {fmtDate(m.meeting_date)}
                          {m.start_time && (
                            <div className="text-[12px] font-normal text-[var(--muted)]">
                              {m.start_time.slice(0, 5)}{m.end_time ? `–${m.end_time.slice(0, 5)}` : ""}
                            </div>
                          )}
                        </td>
                        <td>{m.title}</td>
                        <td className="text-[var(--muted)]">{m.class_name ?? "All classes"}</td>
                        {!centerId && <td className="text-[var(--muted)]">{m.center_name}</td>}
                        <td className="tabular-nums">{m.recorded}</td>
                        <td>
                          <Badge tone={m.status === "completed" ? "ok" : m.status === "cancelled" ? "bad" : "info"}>
                            {titleCase(m.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        {!isTeaching(user.role) && (
          <ScheduleForm centers={centers} classes={classes} showCenter={isGlobalRole(user.role)} />
        )}
      </div>
    </>
  );
}
