import { requireFeature } from "@/lib/auth";
import { centersForUser, currentSession, listSessions, resolveCenterId } from "@/lib/queries";
import { Alert, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import {
  BarChart, ChartFrame, HBarChart, LineChart, StackedBarChart,
} from "@/components/charts";
import { ATTENDANCE_COLORS, SEQ_BLUE, SERIES } from "@/lib/chart-palette";
import {
  admissionsByMonth, admissionsBySession, attendanceByMonth, attendanceDaily,
  byCentre, byClass, promotionOutcomes,
} from "@/lib/statistics";
import { isGlobalRole } from "@/lib/roles";

export const metadata = { title: "Statistics · Pehchaan" };

const ATT_SERIES = [
  { key: "present", label: "Present", color: ATTENDANCE_COLORS.present },
  { key: "late", label: "Late", color: ATTENDANCE_COLORS.late },
  { key: "half_day", label: "Half day", color: ATTENDANCE_COLORS.half_day },
  { key: "leave", label: "Leave", color: ATTENDANCE_COLORS.leave },
  { key: "absent", label: "Absent", color: ATTENDANCE_COLORS.absent },
];

const OUTCOME_SERIES = [
  { key: "promoted", label: "Promoted", color: SERIES[0] },
  { key: "retained", label: "Retained", color: SERIES[1] },
  { key: "graduated", label: "Graduated", color: SERIES[2] },
  { key: "skipped", label: "Held", color: SERIES[3] },
];

export default async function StatisticsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("statistics");
  const sp = await searchParams;
  const [centers, sessions, cur] = await Promise.all([
    centersForUser(user), listSessions(), currentSession(),
  ]);
  if (sessions.length === 0) return <Alert kind="warn">No academic session exists yet.</Alert>;

  const sessionId = Number(sp.session) || cur?.id || sessions[0].id;
  const sessionName = sessions.find((s) => s.id === sessionId)?.name ?? "";
  const centerId = resolveCenterId(user, sp.center);
  const days = Number(sp.days) || 30;

  const [admSession, admMonth, outcomes, daily, monthly, classes, centres] = await Promise.all([
    admissionsBySession(centerId),
    admissionsByMonth(sessionId, centerId),
    promotionOutcomes(centerId),
    attendanceDaily(sessionId, centerId, days),
    attendanceByMonth(sessionId, centerId),
    byClass(sessionId, centerId),
    isGlobalRole(user.role) ? byCentre(sessionId) : Promise.resolve([]),
  ]);

  const thisSession = admSession.find((a) => a.session === sessionName);
  const totalStudents = classes.reduce((n, c) => n + Number(c.students), 0);
  const dailyPct = daily.map((d) => ({
    label: d.label,
    value: Number(d.marked) > 0
      ? Math.round((Number(d.present) / Number(d.marked)) * 1000) / 10 : 0,
    hint: `${d.present} of ${d.marked} marked`,
  }));
  const avgAttendance = dailyPct.length
    ? Math.round((dailyPct.reduce((n, d) => n + d.value, 0) / dailyPct.length) * 10) / 10
    : null;
  const totalGraduated = outcomes.reduce((n, o) => n + Number(o.graduated), 0);
  const totalPromoted = outcomes.reduce((n, o) => n + Number(o.promoted), 0);

  return (
    <>
      <PageHeader
        title="Statistics"
        subtitle={`Admissions, progression and attendance · session ${sessionName}`}
      />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        sessions={sessions}
        current={{ ...sp, session: String(sessionId) }}
        extra={[{ name: "days", label: "Last 30 days", options: [
          { value: "14", label: "Last 14 days" },
          { value: "30", label: "Last 30 days" },
          { value: "60", label: "Last 60 days" },
          { value: "90", label: "Last 90 days" },
        ] }]}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students on the roll" value={totalStudents}
          hint={`in ${classes.length} class${classes.length === 1 ? "" : "es"}`} />
        <StatCard label="Admissions this session"
          value={thisSession ? Number(thisSession.total) : 0}
          hint={thisSession ? `${thisSession.mid} joined mid-session` : "none yet"} />
        <StatCard label="Average attendance"
          value={avgAttendance === null ? "—" : `${avgAttendance}%`}
          hint={`last ${days} days`}
          tone={avgAttendance !== null && avgAttendance < 70 ? "warn" : "default"} />
        <StatCard label="Promoted / graduated" value={`${totalPromoted} / ${totalGraduated}`}
          hint="across all promotion runs" tone="ok" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartFrame
          title="Attendance trend"
          subtitle={`Percentage present each day over the last ${days} days`}
          empty={dailyPct.length === 0}
          table={{ head: ["Day", "Attendance %"], rows: dailyPct.map((d) => [d.label, `${d.value}%`]) }}
        >
          <LineChart data={dailyPct} color={SEQ_BLUE} yMax={100} suffix="%" />
        </ChartFrame>

        <ChartFrame
          title="Attendance by month"
          subtitle="How every marked day was recorded"
          series={ATT_SERIES}
          empty={monthly.length === 0}
          table={{
            head: ["Month", "Present", "Late", "Half day", "Leave", "Absent"],
            rows: monthly.map((m) => [m.label, m.present, m.late, m.half_day, m.leave, m.absent]),
          }}
        >
          <StackedBarChart
            data={monthly.map((m) => ({
              label: m.label,
              parts: {
                present: Number(m.present), late: Number(m.late), half_day: Number(m.half_day),
                leave: Number(m.leave), absent: Number(m.absent),
              },
            }))}
            series={ATT_SERIES}
          />
        </ChartFrame>

        <ChartFrame
          title="Admissions by session"
          subtitle="Students admitted in each academic session"
          empty={admSession.length === 0}
          table={{
            head: ["Session", "Admissions", "New", "Mid-session"],
            rows: admSession.map((a) => [a.session, a.total, a.fresh, a.mid]),
          }}
        >
          <BarChart data={admSession.map((a) => ({
            label: a.session, value: Number(a.total),
            hint: `${a.fresh} new, ${a.mid} mid-session`,
          }))} color={SEQ_BLUE} />
        </ChartFrame>

        <ChartFrame
          title="Admissions by month"
          subtitle={`When students joined during ${sessionName}`}
          empty={admMonth.length === 0}
          table={{ head: ["Month", "Admissions"], rows: admMonth.map((a) => [a.label, a.n]) }}
        >
          <BarChart data={admMonth.map((a) => ({ label: a.label, value: Number(a.n) }))}
            color={SEQ_BLUE} />
        </ChartFrame>

        <ChartFrame
          title="Progression at the end of each session"
          subtitle="What happened to students when the session closed"
          series={OUTCOME_SERIES}
          empty={outcomes.length === 0}
          table={{
            head: ["Session", "Promoted", "Retained", "Graduated", "Held"],
            rows: outcomes.map((o) => [o.session, o.promoted, o.retained, o.graduated, o.skipped]),
          }}
        >
          <StackedBarChart
            data={outcomes.map((o) => ({
              label: o.session,
              parts: {
                promoted: Number(o.promoted), retained: Number(o.retained),
                graduated: Number(o.graduated), skipped: Number(o.skipped),
              },
            }))}
            series={OUTCOME_SERIES}
          />
        </ChartFrame>

        <ChartFrame
          title="Students by class"
          subtitle="Head count on the roll this session"
          empty={classes.length === 0}
          table={{
            head: ["Class", "Students", "Attendance %"],
            rows: classes.map((c) => [c.class_name, c.students, c.attendance_pct ?? "—"]),
          }}
        >
          <HBarChart data={classes.map((c) => ({
            label: c.class_name, value: Number(c.students),
          }))} color={SEQ_BLUE} />
        </ChartFrame>

        {isGlobalRole(user.role) && centres.length > 0 && (
          <>
            <ChartFrame
              title="Students by centre"
              subtitle="Head count on the roll this session"
              table={{
                head: ["Centre", "Students", "Attendance %"],
                rows: centres.map((c) => [c.center_name, c.students, c.attendance_pct ?? "—"]),
              }}
            >
              <HBarChart data={centres.map((c) => ({
                label: c.center_name, value: Number(c.students),
              }))} color={SEQ_BLUE} />
            </ChartFrame>

            <ChartFrame
              title="Attendance by centre"
              subtitle="Percentage present across the session"
              table={{
                head: ["Centre", "Attendance %"],
                rows: centres.map((c) => [c.center_name, c.attendance_pct ?? "—"]),
              }}
            >
              <HBarChart
                data={centres.map((c) => ({
                  label: c.center_name, value: Number(c.attendance_pct ?? 0),
                }))}
                color={SERIES[2]} suffix="%"
              />
            </ChartFrame>
          </>
        )}
      </div>
    </>
  );
}
