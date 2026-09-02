import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import AttendanceSheet, { type Row } from "./AttendanceSheet";
import AttendancePicker from "./AttendancePicker";
import { fmtDate, today } from "@/lib/format";
import { closeRegisterUpToYesterday } from "@/lib/attendance";
import { holidayOn } from "@/lib/calendar";
import { EVENT_LABEL } from "@/lib/calendar-meta";
import { isGlobalRole } from "@/lib/roles";

export default async function AttendancePage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);

  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;
  if (centers.length === 0)
    return <Alert kind="warn">You are not assigned to a centre yet.</Alert>;

  // Close out any past day that was never filled in — those students go down as absent.
  await closeRegisterUpToYesterday();

  const centerId = resolveCenterId(user, sp.center) ?? (centers.length === 1 ? centers[0].id : null);
  const classId = Number(sp.class) || null;
  const attDate = sp.date || today();
  const future = attDate > today();
  const isPast = attDate < today();

  let rows: Row[] = [];
  if (centerId && classId) {
    rows = await query<Row>(
      `SELECT e.id AS enrollment_id, s.id AS student_id, s.enrollment_no,
              s.first_name, s.last_name, e.roll_no, a.status
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         LEFT JOIN student_attendance a
           ON a.student_id = s.id AND a.att_date = $4
        WHERE e.session_id = $1 AND e.class_level_id = $2 AND e.center_id = $3
          AND e.status = 'active' AND s.status = 'active'
        ORDER BY e.roll_no NULLS LAST, s.first_name`,
      [session.id, classId, centerId, attDate],
    );
  }

  const holiday = centerId ? await holidayOn(attDate, centerId) : null;
  const markedCount = rows.filter((r) => r.status).length;

  return (
    <>
      <PageHeader
        title="Student attendance"
        subtitle={`Session ${session.name}${
          markedCount ? ` · ${markedCount} of ${rows.length} already marked for this date` : ""}`}
      />

      <Card className="mb-4">
        <AttendancePicker
          centers={isGlobalRole(user.role) ? centers : []}
          classes={classes}
          defaults={{ center: String(centerId ?? ""), class: String(classId ?? ""), date: attDate }}
        />
      </Card>

      {future && <div className="mb-4"><Alert kind="warn">Attendance cannot be marked for a future date.</Alert></div>}

      {holiday && (
        <div className="mb-4">
          <Alert kind="info">
            {fmtDate(attDate)} is on the calendar as {(EVENT_LABEL[holiday.event_type] ?? "a holiday").toLowerCase()}
            {" "}— <strong>{holiday.title}</strong>. Attendance is not taken, and this day is
            skipped by the nightly auto-absent close-out.
          </Alert>
        </div>
      )}

      {isPast && !future && !holiday && (
        <div className="mb-4">
          <Alert kind="warn">
            {fmtDate(attDate)} is closed. Present, late and half day can only be given on the
            day itself — anyone left unmarked that day has already been recorded as absent.
            A closed day can still be corrected to leave or absent.
          </Alert>
        </div>
      )}

      {!centerId || !classId ? (
        <Card pad={false}>
          <Empty title="Choose a class"
            hint="Pick the centre, class and date above to load the roster." />
        </Card>
      ) : rows.length === 0 ? (
        <Card pad={false}>
          <Empty title="No students in this class"
            hint="Nobody is enrolled in this class for the selected centre and session." />
        </Card>
      ) : (
        <AttendanceSheet
          rows={rows} attDate={attDate} sessionId={session.id}
          classLevelId={classId} centerId={centerId} locked={future || Boolean(holiday)}
          isPast={isPast}
        />
      )}
    </>
  );
}
