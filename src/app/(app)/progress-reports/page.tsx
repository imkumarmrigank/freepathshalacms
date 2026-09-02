import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { centersForUser, currentSession, listClasses, listSessions, resolveCenterId } from "@/lib/queries";
import { classProgress } from "@/lib/report-card";
import { Alert, Avatar, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { fullName } from "@/lib/format";
import { grade, percentage } from "@/lib/exam-meta";
import { isGlobalRole } from "@/lib/roles";

export const metadata = { title: "Progress reports · FreePathshala CMS" };

export default async function ProgressReportsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, classes, sessions, cur] = await Promise.all([
    centersForUser(user), listClasses(), listSessions(), currentSession(),
  ]);
  if (!cur && sessions.length === 0)
    return <Alert kind="warn">No academic session exists yet.</Alert>;

  const sessionId = Number(sp.session) || cur?.id || sessions[0]?.id;
  const centerId = resolveCenterId(user, sp.center);
  const classId = Number(sp.class) || null;

  const rows = await classProgress(sessionId, centerId, classId);

  const printQuery = new URLSearchParams({
    session: String(sessionId),
    ...(centerId ? { center: String(centerId) } : {}),
    ...(classId ? { class: String(classId) } : {}),
  }).toString();

  const withMarks = rows.filter((r) => Number(r.papers) > 0).length;

  return (
    <>
      <PageHeader
        title="Progress reports"
        subtitle="Pick a class, then open or print each student's report card"
        right={
          rows.length > 0 ? (
            <Link href={`/progress-reports/print?${printQuery}`} className="btn btn-primary"
              prefetch={false}>
              Print all {rows.length} report card{rows.length === 1 ? "" : "s"}
            </Link>
          ) : undefined
        }
      />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        sessions={sessions}
        current={{ ...sp, session: String(sessionId) }}
      />

      {rows.length > 0 && withMarks === 0 && (
        <div className="mt-4">
          <Alert kind="info">
            No marks have been entered for this class yet, so the cards will show attendance only.
          </Alert>
        </div>
      )}

      <Card className="mt-4 overflow-hidden" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No students found"
            hint="Choose a different class or centre, or check that students are enrolled in this session." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-12">Roll</th>
                  <th>Student</th>
                  <th>Class</th>
                  {!centerId && <th>Centre</th>}
                  <th>Tests</th>
                  <th>Marks</th>
                  <th>Overall</th>
                  <th>Attendance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const obtained = r.obtained === null ? null : Number(r.obtained);
                  const outOf = r.out_of === null ? null : Number(r.out_of);
                  const pct = obtained === null || !outOf ? null : percentage(obtained, outOf);
                  return (
                    <tr key={r.student_id}>
                      <td className="tabular-nums text-[var(--muted)]">{r.roll_no ?? i + 1}</td>
                      <td>
                        <Link href={`/students/${r.student_id}/report-card?session=${sessionId}`}
                          className="flex items-center gap-2.5 hover:text-[var(--brand)]">
                          <Avatar name={fullName(r)} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{fullName(r)}</span>
                            <span className="block font-mono text-[11px] text-[var(--faint)]">
                              {r.enrollment_no}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="text-[var(--muted)]">{r.class_name}</td>
                      {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                      <td className="tabular-nums text-[var(--muted)]">{r.tests}</td>
                      <td className="whitespace-nowrap tabular-nums">
                        {obtained === null || !outOf
                          ? <span className="text-[var(--faint)]">—</span>
                          : <>{obtained}<span className="text-[var(--faint)]"> / {outOf}</span></>}
                      </td>
                      <td>
                        {pct === null
                          ? <span className="text-[var(--faint)]">Not graded</span>
                          : <Badge tone={pct >= 60 ? "ok" : pct >= 40 ? "warn" : "bad"} dot={false}>
                              {grade(pct)} · {pct}%
                            </Badge>}
                      </td>
                      <td>
                        {r.attendance_pct === null
                          ? <span className="text-[13px] text-[var(--faint)]">—</span>
                          : <Meter value={Number(r.attendance_pct)} />}
                      </td>
                      <td className="text-right">
                        <Link href={`/students/${r.student_id}/report-card?session=${sessionId}`}
                          className="btn btn-ghost btn-sm">
                          Report card
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
