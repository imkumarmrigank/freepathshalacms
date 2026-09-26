import "server-only";
import { query } from "./db";
import { groupByOf, reportByKey, type GroupBy } from "./report-meta";
import { titleCase } from "./format";
import type { SessionUser } from "./auth";
import { isGlobalRole, ROLE_LABEL, type Role } from "./roles";
import { auditorDays, mentorDays, sportsDays } from "./day-book";
import { FAMILY_PHONE, PARENT_NAME, PHONE } from "./ptm-dashboard";

export type ReportColumn = { key: string; label: string; width?: number; numeric?: boolean };
export type ReportRow = Record<string, string | number | null>;
export type ReportResult = {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type ReportParams = {
  from: string;
  to: string;
  centerId: number | null;
  classId: number | null;
  sessionId: number;
  role: string | null;
  /** day, week or month — only the running reports read it */
  groupBy?: string | null;
};

const COUNTED = "('present','late','half_day')";   // counts towards attendance
const MARKED = "status <> 'holiday'";              // days that count in the denominator

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

/** Every date in [from, to], capped so a huge range cannot blow up the register. */
// Pure arithmetic on a date string: anchored at UTC midnight and stepped in
// UTC, so it is the same answer in any timezone. Not a "now", so it must
// not be moved onto the local clock.
function datesBetween(from: string, to: string, cap = 62) {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < cap) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export async function runReport(
  key: string,
  p: ReportParams,
  user: SessionUser,
): Promise<ReportResult> {
  const meta = reportByKey(key);
  if (!meta) throw new Error("Unknown report.");
  if (meta.roles && !meta.roles.includes(user.role))
    throw new Error("You don’t have access to this report.");

  // Non-admins can never widen the scope past their own centre.
  const centerId = isGlobalRole(user.role)
    ? p.centerId
    : user.role === "backup_teacher"
      ? (p.centerId != null && user.centerIds.includes(p.centerId)
          ? p.centerId : user.centerIds[0] ?? -1)
      : user.centerId;
  const scoped = { ...p, centerId };
  const period = `${p.from} to ${p.to}`;

  switch (key) {
    case "dropouts":                     return dropouts(scoped, period);
    case "dropout-reasons":              return dropoutReasons(scoped, period);
    case "student-transfers":            return studentTransfers(scoped, period);
    case "suspended-students":           return offRoll(scoped, "suspended");
    case "passed-out-students":          return offRoll(scoped, "graduated");
    case "student-reactivations":        return reactivations(scoped, period);
    case "student-attendance-summary":   return studentAttendanceSummary(scoped, period);
    case "student-attendance-trend":     return studentAttendanceTrend(scoped, period);
    case "staff-attendance-trend":       return staffAttendanceTrend(scoped, period);
    case "student-attendance-register":  return studentAttendanceRegister(scoped, period);
    case "staff-attendance-register":    return staffAttendanceRegister(scoped, period);
    case "staff-attendance-summary":     return staffAttendanceSummary(scoped, period);
    case "staff-attendance-detail":      return staffAttendanceDetail(scoped, period);
    case "counselling-referrals":        return counsellingReferrals(scoped, period);
    case "counselling-summary":          return counsellingSummary(scoped, period);
    case "students-by-class":            return studentsByClass(scoped);
    case "student-roster":               return studentRoster(scoped);
    case "admissions":                   return admissions(scoped, period);
    case "supplies-stock":               return suppliesStock(scoped);
    case "hq-stock":                     return hqStock();
    case "hq-receipts":                  return hqReceipts(scoped, period);
    case "supplies-dispatched":          return suppliesDispatched(scoped, period);
    case "supplies-by-centre":           return suppliesByCentre(scoped);
    case "supplies-issued":              return suppliesIssued(scoped, period);
    case "exam-marks":                   return examMarks(scoped, period);
    case "exam-summary":                 return examSummary(scoped, period);
    case "ptm-summary":                  return ptmSummary(scoped, period);
    case "ptm-daily":                    return ptmDaily(scoped, period);
    case "ptm-attendance":               return ptmAttendance(scoped, period);
    case "mentor-daily":                 return mentorDaily(scoped, period);
    case "auditor-daily":                return auditorDaily(scoped, period);
    case "sports-daily":                 return sportsDaily(scoped, period);
    case "ptm-concerns":                 return ptmConcernsReport(scoped, period);
    case "teaching-plan-progress":       return teachingPlanProgress(scoped);
    case "timetable":                    return timetableReport(scoped);
    case "audit-visits":                 return auditVisitsReport(scoped, period);
    case "audit-suggestions":            return auditSuggestionsReport(scoped, period);
    case "audit-ratings":                return auditRatingsReport(scoped, period);
    case "sports-visits":                return sportsVisits(scoped, period);
    case "sports-teacher-days":          return sportsTeacherDays(scoped, period);
    case "sports-players":               return sportsPlayers(scoped);
    case "sports-attendance":            return sportsAttendance(scoped, period);
    case "sports-marks":                 return sportsMarks(scoped, period);
    case "sports-talent":                return sportsTalent(scoped);
    default: throw new Error("Unknown report.");
  }
}

/* ------------------------------------------------------------ counselling */

/**
 * Referrals a teacher has raised. Kept as one row per child rather than one per
 * reason, because the question an administrator asks is "who is waiting", and
 * the reasons are the detail underneath that.
 */
async function counsellingReferrals(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND f.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND f.class_level_id = $${params.length}`; }

  const rows = await query<{
    raised_on: string; enrollment_no: string; student: string; class_name: string | null;
    center_name: string; reasons: string[]; note: string | null; urgency: string;
    status: string; raised_by: string | null; mentor: string | null;
    outcome: string | null; closed_on: string | null; days_open: string;
    picked_up_on: string | null; actions: string | null;
  }>(
    `SELECT f.raised_on, s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            cl.name AS class_name, ce.name AS center_name,
            f.reasons, f.note, f.urgency, f.status, f.outcome, f.closed_on,
            f.picked_up_on, r.name AS raised_by, m.name AS mentor,
            COALESCE(f.closed_on, CURRENT_DATE) - f.raised_on AS days_open,
            (SELECT string_agg(
                      to_char(x.acted_on, 'DD Mon') || ' — '
                      || CASE x.kind WHEN 'picked_up' THEN 'Picked up'
                                     WHEN 'note'      THEN 'Followed up'
                                     WHEN 'closed'    THEN 'Closed'
                                     ELSE 'Reopened' END
                      || COALESCE(': ' || x.note, ''),
                      ' | ' ORDER BY x.acted_on, x.id)
               FROM counselling_actions x WHERE x.flag_id = f.id) AS actions
       FROM counselling_flags f
       JOIN students s ON s.id = f.student_id
       JOIN centers ce ON ce.id = f.center_id
       LEFT JOIN class_levels cl ON cl.id = f.class_level_id
       LEFT JOIN users r ON r.id = f.raised_by
       LEFT JOIN users m ON m.id = f.mentor_id
      WHERE f.raised_on BETWEEN $1 AND $2 ${where}
      ORDER BY (f.status <> 'closed') DESC, (f.urgency = 'high') DESC, f.raised_on DESC`,
    params,
  );

  return {
    title: "Counselling referrals",
    subtitle: `${period} · ${rows.length} referral${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "raised_on", label: "Raised", width: 12 },
      { key: "student", label: "Student", width: 22 },
      { key: "enrollment_no", label: "Enrolment no.", width: 14 },
      { key: "class_name", label: "Class" },
      { key: "center_name", label: "Centre" },
      { key: "reasons", label: "Reasons", width: 40 },
      { key: "note", label: "What the teacher wrote", width: 44 },
      { key: "urgency", label: "Urgency" },
      { key: "raised_by", label: "Raised by", width: 18 },
      { key: "status", label: "Status", width: 20 },
      { key: "mentor", label: "With", width: 18 },
      { key: "picked_up_on", label: "Picked up", width: 12 },
      { key: "actions", label: "What the mentor did, step by step", width: 60 },
      { key: "days_open", label: "Days open", numeric: true },
      { key: "outcome", label: "Outcome", width: 40 },
      { key: "closed_on", label: "Closed", width: 12 },
    ],
    rows: rows.map((r) => ({
      raised_on: r.raised_on,
      student: r.student,
      enrollment_no: r.enrollment_no,
      class_name: r.class_name ?? "—",
      center_name: r.center_name,
      reasons: (r.reasons ?? []).join("; "),
      note: r.note ?? "",
      urgency: r.urgency === "high" ? "Urgent" : "Normal",
      raised_by: r.raised_by ?? "—",
      status: r.status === "open" ? "Awaiting mentor"
        : r.status === "in_progress" ? "Counselling under way" : "Closed",
      mentor: r.mentor ?? "—",
      picked_up_on: r.picked_up_on ?? "",
      actions: r.actions ?? "",
      days_open: Number(r.days_open),
      outcome: r.outcome ?? "",
      closed_on: r.closed_on ?? "",
    })),
  };
}

/** The same referrals counted by reason, so a pattern at one centre shows up. */
async function counsellingSummary(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND f.center_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; reason: string; total: string; open: string;
    urgent: string; avg_days: string | null;
  }>(
    `SELECT ce.name AS center_name, reason,
            count(*)                                        AS total,
            count(*) FILTER (WHERE f.status <> 'closed')    AS open,
            count(*) FILTER (WHERE f.urgency = 'high')      AS urgent,
            round(avg(COALESCE(f.closed_on, CURRENT_DATE) - f.raised_on), 1) AS avg_days
       FROM counselling_flags f
       JOIN centers ce ON ce.id = f.center_id
       CROSS JOIN LATERAL unnest(f.reasons) AS reason
      WHERE f.raised_on BETWEEN $1 AND $2 ${where}
      GROUP BY ce.name, ce.code, reason
      ORDER BY ce.code, count(*) DESC`,
    params,
  );

  return {
    title: "Counselling — reasons and load",
    subtitle: `${period} · ${rows.length} row${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "center_name", label: "Centre", width: 16 },
      { key: "reason", label: "Reason", width: 34 },
      { key: "total", label: "Referrals", numeric: true },
      { key: "open", label: "Still open", numeric: true },
      { key: "urgent", label: "Urgent", numeric: true },
      { key: "avg_days", label: "Avg days open", numeric: true },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name,
      reason: r.reason,
      total: Number(r.total),
      open: Number(r.open),
      urgent: Number(r.urgent),
      avg_days: r.avg_days === null ? 0 : Number(r.avg_days),
    })),
  };
}

/* ------------------------------------------------------------- attendance */

/** Postgres date_trunc unit, and how the bucket should read on the page. */
const BUCKET: Record<GroupBy, { unit: string; label: string }> = {
  day:   { unit: "day",   label: "Day" },
  week:  { unit: "week",  label: "Week beginning" },
  month: { unit: "month", label: "Month" },
};

/**
 * Attendance added up over time rather than per student — the shape you want
 * when the question is "how are the centres doing", not "how is this child
 * doing". Each row is one bucket at one centre, and the running columns carry
 * the total from the start of the period so the trend can be read straight off.
 */
async function studentAttendanceTrend(p: ReportParams, period: string): Promise<ReportResult> {
  const g = groupByOf(p.groupBy);
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND a.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND a.class_level_id = $${params.length}`; }

  const rows = await query<{
    bucket: string; center_name: string; students: string; marked: string;
    present: string; absent: string; late: string; half_day: string; leave: string;
  }>(
    `SELECT to_char(date_trunc('${BUCKET[g].unit}', a.att_date), 'YYYY-MM-DD') AS bucket,
            ce.name AS center_name,
            count(DISTINCT a.student_id)                    AS students,
            count(*) FILTER (WHERE ${MARKED})               AS marked,
            count(*) FILTER (WHERE a.status = 'present')    AS present,
            count(*) FILTER (WHERE a.status = 'absent')     AS absent,
            count(*) FILTER (WHERE a.status = 'late')       AS late,
            count(*) FILTER (WHERE a.status = 'half_day')   AS half_day,
            count(*) FILTER (WHERE a.status = 'leave')      AS leave
       FROM student_attendance a
       JOIN centers ce ON ce.id = a.center_id
      WHERE a.session_id = $1 AND a.att_date BETWEEN $2 AND $3 ${where}
      GROUP BY 1, ce.name, ce.code
      ORDER BY 1, ce.code`,
    params,
  );

  // running totals, kept per centre so a multi-centre report reads sensibly
  const seen = new Map<string, { counted: number; marked: number }>();
  const out: ReportRow[] = rows.map((r) => {
    const counted = Number(r.present) + Number(r.late) + Number(r.half_day);
    const marked = Number(r.marked);
    const acc = seen.get(r.center_name) ?? { counted: 0, marked: 0 };
    acc.counted += counted; acc.marked += marked;
    seen.set(r.center_name, acc);
    return {
      bucket: g === "month" ? r.bucket.slice(0, 7) : r.bucket,
      center_name: r.center_name,
      students: Number(r.students),
      marked,
      present: Number(r.present),
      late: Number(r.late),
      half_day: Number(r.half_day),
      absent: Number(r.absent),
      leave: Number(r.leave),
      pct: pct(counted, marked),
      running_pct: pct(acc.counted, acc.marked),
    };
  });

  return {
    title: "Student attendance over time",
    subtitle: `${period} · ${BUCKET[g].label.toLowerCase()} · ${out.length} row${out.length === 1 ? "" : "s"}`,
    columns: [
      { key: "bucket", label: BUCKET[g].label, width: 16 },
      { key: "center_name", label: "Centre", width: 14 },
      { key: "students", label: "Students", numeric: true },
      { key: "marked", label: "Days marked", numeric: true },
      { key: "present", label: "Present", numeric: true },
      { key: "late", label: "Late", numeric: true },
      { key: "half_day", label: "Half day", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "leave", label: "Leave", numeric: true },
      { key: "pct", label: "Attendance %", numeric: true },
      { key: "running_pct", label: "Running %", numeric: true },
    ],
    rows: out,
  };
}

/** The same shape for staff, counted off their own check-ins. */
async function staffAttendanceTrend(p: ReportParams, period: string): Promise<ReportResult> {
  const g = groupByOf(p.groupBy);
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND a.center_id = $${params.length}`; }
  if (p.role) { params.push(p.role); where += ` AND u.role = $${params.length}`; }

  const rows = await query<{
    bucket: string; center_name: string; staff: string; days: string;
    present: string; late: string; absent: string; half_day: string;
    minutes: string | null; off_site: string;
  }>(
    `SELECT to_char(date_trunc('${BUCKET[g].unit}', a.att_date), 'YYYY-MM-DD') AS bucket,
            ce.name AS center_name,
            count(DISTINCT a.user_id)                        AS staff,
            count(*)                                         AS days,
            count(*) FILTER (WHERE a.status = 'present')     AS present,
            count(*) FILTER (WHERE a.status = 'late')        AS late,
            count(*) FILTER (WHERE a.status = 'absent')      AS absent,
            count(*) FILTER (WHERE a.status = 'half_day')    AS half_day,
            sum(a.worked_minutes)                            AS minutes,
            count(*) FILTER (WHERE NOT a.within_geofence)    AS off_site
       FROM staff_attendance a
       JOIN centers ce ON ce.id = a.center_id
       JOIN users u ON u.id = a.user_id
      WHERE a.att_date BETWEEN $1 AND $2 ${where}
      GROUP BY 1, ce.name, ce.code
      ORDER BY 1, ce.code`,
    params,
  );

  const seen = new Map<string, { on: number; days: number }>();
  const out: ReportRow[] = rows.map((r) => {
    const on = Number(r.present) + Number(r.late) + Number(r.half_day);
    const days = Number(r.days);
    const acc = seen.get(r.center_name) ?? { on: 0, days: 0 };
    acc.on += on; acc.days += days;
    seen.set(r.center_name, acc);
    const mins = Number(r.minutes ?? 0);
    return {
      bucket: g === "month" ? r.bucket.slice(0, 7) : r.bucket,
      center_name: r.center_name,
      staff: Number(r.staff),
      days,
      present: Number(r.present),
      late: Number(r.late),
      half_day: Number(r.half_day),
      absent: Number(r.absent),
      hours: Math.round(mins / 6) / 10,
      off_site: Number(r.off_site),
      pct: pct(on, days),
      running_pct: pct(acc.on, acc.days),
    };
  });

  return {
    title: "Staff attendance over time",
    subtitle: `${period} · ${BUCKET[g].label.toLowerCase()} · ${out.length} row${out.length === 1 ? "" : "s"}`,
    columns: [
      { key: "bucket", label: BUCKET[g].label, width: 16 },
      { key: "center_name", label: "Centre", width: 14 },
      { key: "staff", label: "Staff", numeric: true },
      { key: "days", label: "Days recorded", numeric: true },
      { key: "present", label: "Present", numeric: true },
      { key: "late", label: "Late", numeric: true },
      { key: "half_day", label: "Half day", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "hours", label: "Hours logged", numeric: true },
      { key: "off_site", label: "Off site", numeric: true },
      { key: "pct", label: "On duty %", numeric: true },
      { key: "running_pct", label: "Running %", numeric: true },
    ],
    rows: out,
  };
}

async function studentAttendanceSummary(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND e.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND e.class_level_id = $${params.length}`; }

  const rows = await query<{
    enrollment_no: string; student: string; class_name: string; center_name: string;
    present: string; absent: string; late: string; half_day: string; leave: string; marked: string;
  }>(
    `SELECT s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            cl.name AS class_name, ce.name AS center_name,
            count(a.*) FILTER (WHERE a.status = 'present')  AS present,
            count(a.*) FILTER (WHERE a.status = 'absent')   AS absent,
            count(a.*) FILTER (WHERE a.status = 'late')     AS late,
            count(a.*) FILTER (WHERE a.status = 'half_day') AS half_day,
            count(a.*) FILTER (WHERE a.status = 'leave')    AS leave,
            count(a.*) FILTER (WHERE a.${MARKED})           AS marked
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       LEFT JOIN student_attendance a
         ON a.enrollment_id = e.id AND a.att_date BETWEEN $2 AND $3
      WHERE e.session_id = $1 ${where}
      GROUP BY s.enrollment_no, student, cl.name, cl.sequence, ce.name, ce.code
      ORDER BY ce.code, cl.sequence, student`,
    params,
  );

  return {
    title: "Student attendance summary",
    subtitle: period,
    columns: [
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 26 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "present", label: "Present", numeric: true },
      { key: "late", label: "Late", numeric: true },
      { key: "half_day", label: "Half day", numeric: true },
      { key: "leave", label: "Leave", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "marked", label: "Days marked", numeric: true, width: 14 },
      { key: "attendance_pct", label: "Attendance %", numeric: true, width: 14 },
    ],
    rows: rows.map((r) => ({
      ...r,
      present: Number(r.present), absent: Number(r.absent), late: Number(r.late),
      half_day: Number(r.half_day), leave: Number(r.leave), marked: Number(r.marked),
      attendance_pct: pct(
        Number(r.present) + Number(r.late) + Number(r.half_day),
        Number(r.marked),
      ),
    })),
  };
}

async function studentAttendanceRegister(p: ReportParams, period: string): Promise<ReportResult> {
  const dates = datesBetween(p.from, p.to);
  const params: unknown[] = [p.sessionId, dates[0], dates[dates.length - 1]];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND e.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND e.class_level_id = $${params.length}`; }

  const rows = await query<{
    student_id: number; enrollment_no: string; student: string;
    class_name: string; center_name: string; att_date: string | null; status: string | null;
  }>(
    `SELECT s.id AS student_id, s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            cl.name AS class_name, ce.name AS center_name,
            a.att_date, a.status
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       LEFT JOIN student_attendance a
         ON a.enrollment_id = e.id AND a.att_date BETWEEN $2 AND $3
      WHERE e.session_id = $1 ${where}
      ORDER BY ce.code, cl.sequence, student`,
    params,
  );

  const CODE: Record<string, string> = {
    present: "P", absent: "A", late: "L", half_day: "H", leave: "Lv", holiday: "—",
  };

  const byStudent = new Map<number, ReportRow>();
  for (const r of rows) {
    let row = byStudent.get(r.student_id);
    if (!row) {
      row = {
        enrollment_no: r.enrollment_no, student: r.student,
        class_name: r.class_name, center_name: r.center_name,
      };
      for (const d of dates) row[d] = "";
      byStudent.set(r.student_id, row);
    }
    if (r.att_date && r.status) row[r.att_date.slice(0, 10)] = CODE[r.status] ?? r.status;
  }

  return {
    title: "Student attendance register",
    subtitle: `${period} · P present, L late, H half day, Lv leave, A absent`,
    columns: [
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 26 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "center_name", label: "Centre", width: 18 },
      ...dates.map((d) => ({ key: d, label: d.slice(8) + "/" + d.slice(5, 7), width: 6 })),
    ],
    rows: [...byStudent.values()],
  };
}

/**
 * The staff equivalent of the student register, and deliberately not the same
 * thing: a child is present or absent, but a teacher's day is a time. Each
 * square holds when they arrived and when they left, so the question the office
 * actually asks — who opened the centre late — is answered by reading across.
 */
async function staffAttendanceRegister(p: ReportParams, period: string): Promise<ReportResult> {
  const dates = datesBetween(p.from, p.to);
  const params: unknown[] = [dates[0], dates[dates.length - 1]];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND u.center_id = $${params.length}`; }
  if (p.role) { params.push(p.role); where += ` AND u.role = $${params.length}`; }

  const rows = await query<{
    user_id: number; name: string; role: string; center_name: string | null;
    att_date: string | null; status: string | null;
    check_in: string | null; check_out: string | null; spells: number | null;
  }>(
    `SELECT u.id AS user_id, u.name, u.role, c.name AS center_name,
            a.att_date, a.status,
            to_char(a.check_in_at  AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS check_in,
            to_char(a.check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS check_out,
            (SELECT count(*) FROM staff_punches sp WHERE sp.attendance_id = a.id) AS spells
       FROM users u
       LEFT JOIN centers c ON c.id = u.center_id
       LEFT JOIN staff_attendance a
              ON a.user_id = u.id AND a.att_date BETWEEN $1 AND $2
      WHERE u.is_active AND u.role IN ('teacher','center_manager','backup_teacher','rider') ${where}
      ORDER BY c.code NULLS LAST, u.name, a.att_date`,
    params,
  );

  // What a square says when nobody punched: the register still knows why.
  const MARK: Record<string, string> = {
    absent: "A", leave: "Lv", holiday: "—", present: "P", late: "L", half_day: "H",
  };

  const byStaff = new Map<number, ReportRow>();
  for (const r of rows) {
    let row = byStaff.get(r.user_id);
    if (!row) {
      row = { name: r.name, role_label: ROLE_LABEL[r.role as Role] ?? r.role,
              center_name: r.center_name ?? "—" };
      for (const d of dates) row[d] = "";
      byStaff.set(r.user_id, row);
    }
    if (!r.att_date) continue;
    const key = r.att_date.slice(0, 10);
    if (r.check_in) {
      const times = `${r.check_in}-${r.check_out ?? "…"}`;
      row[key] = Number(r.spells ?? 1) > 1 ? `${times} (${r.spells})` : times;
    } else {
      row[key] = MARK[r.status ?? ""] ?? r.status ?? "";
    }
  }

  return {
    title: "Staff attendance register",
    subtitle: `${period} · check-in and check-out time · A absent, Lv leave, `
      + `(2) means they left and came back`,
    columns: [
      { key: "name", label: "Staff", width: 22 },
      { key: "role_label", label: "Role", width: 14 },
      { key: "center_name", label: "Centre", width: 16 },
      ...dates.map((d) => ({ key: d, label: d.slice(8) + "/" + d.slice(5, 7), width: 12 })),
    ],
    rows: [...byStaff.values()],
  };
}

async function staffAttendanceSummary(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND u.center_id = $${params.length}`; }
  if (p.role) { params.push(p.role); where += ` AND u.role = $${params.length}`; }

  const rows = await query<{
    name: string; role: string; center_name: string | null;
    present: string; late: string; absent: string; leave: string; minutes: string;
    avg_distance: string | null; overrides: string;
  }>(
    `SELECT u.name, u.role, c.name AS center_name,
            count(a.*) FILTER (WHERE a.status = 'present') AS present,
            count(a.*) FILTER (WHERE a.status = 'late')    AS late,
            count(a.*) FILTER (WHERE a.status = 'absent')  AS absent,
            count(a.*) FILTER (WHERE a.status = 'leave')   AS leave,
            COALESCE(sum(a.worked_minutes), 0)             AS minutes,
            round(avg(a.check_in_distance_m))              AS avg_distance,
            count(a.*) FILTER (WHERE a.override_by IS NOT NULL) AS overrides
       FROM users u
       LEFT JOIN centers c ON c.id = u.center_id
       LEFT JOIN staff_attendance a
         ON a.user_id = u.id AND a.att_date BETWEEN $1 AND $2
      WHERE u.is_active AND u.role IN ('teacher','center_manager','rider') ${where}
      GROUP BY u.name, u.role, c.name, c.code
      ORDER BY c.code, u.role, u.name`,
    params,
  );

  const LABEL: Record<string, string> = {
    teacher: "Teacher", center_manager: "Centre Manager", super_admin: "Super Admin",
  };

  return {
    title: "Staff attendance summary",
    subtitle: period,
    columns: [
      { key: "name", label: "Staff", width: 24 },
      { key: "role_label", label: "Role", width: 16 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "present", label: "Present", numeric: true },
      { key: "late", label: "Late", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "leave", label: "Leave", numeric: true },
      { key: "days_marked", label: "Days marked", numeric: true, width: 13 },
      { key: "hours", label: "Hours", numeric: true },
      { key: "avg_distance", label: "Avg distance (m)", numeric: true, width: 17 },
      { key: "overrides", label: "Manual entries", numeric: true, width: 15 },
    ],
    rows: rows.map((r) => {
      const present = Number(r.present), late = Number(r.late);
      return {
        name: r.name, role_label: LABEL[r.role] ?? r.role, center_name: r.center_name,
        present, late, absent: Number(r.absent), leave: Number(r.leave),
        days_marked: present + late + Number(r.absent) + Number(r.leave),
        hours: Math.round((Number(r.minutes) / 60) * 10) / 10,
        avg_distance: r.avg_distance === null ? null : Number(r.avg_distance),
        overrides: Number(r.overrides),
      };
    }),
  };
}

async function staffAttendanceDetail(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND a.center_id = $${params.length}`; }
  if (p.role) { params.push(p.role); where += ` AND u.role = $${params.length}`; }

  const rows = await query<{
    att_date: string; name: string; role: string; center_name: string;
    check_in: string | null; check_out: string | null; worked_minutes: number | null;
    status: string; check_in_distance_m: number | null; within_geofence: boolean;
    override_by_name: string | null; override_reason: string | null;
    by_hand: boolean | null; away_reason: string | null;
  }>(
    `SELECT a.att_date, u.name, u.role, c.name AS center_name,
            to_char(a.check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')  AS check_in,
            to_char(a.check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS check_out,
            a.worked_minutes, a.status, a.check_in_distance_m, a.within_geofence,
            o.name AS override_by_name, a.override_reason, a.by_hand, a.away_reason
       FROM staff_attendance a
       JOIN users u ON u.id = a.user_id
       JOIN centers c ON c.id = a.center_id
       LEFT JOIN users o ON o.id = a.override_by
      WHERE a.att_date BETWEEN $1 AND $2 ${where}
      ORDER BY a.att_date DESC, c.code, u.name`,
    params,
  );

  return {
    title: "Staff attendance — day by day",
    subtitle: period,
    columns: [
      { key: "att_date", label: "Date", width: 13 },
      { key: "name", label: "Staff", width: 24 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "check_in", label: "In", width: 11 },
      { key: "check_out", label: "Out", width: 11 },
      { key: "hours", label: "Hours", numeric: true },
      { key: "check_in_distance_m", label: "Distance (m)", numeric: true, width: 13 },
      { key: "status", label: "Status", width: 12 },
      { key: "entry", label: "Entry", width: 16 },
      { key: "override_reason", label: "Reason", width: 30 },
    ],
    rows: rows.map((r) => ({
      att_date: r.att_date.slice(0, 10), name: r.name, center_name: r.center_name,
      check_in: r.check_in, check_out: r.check_out,
      hours: r.worked_minutes ? Math.round((r.worked_minutes / 60) * 10) / 10 : 0,
      check_in_distance_m: r.check_in_distance_m,
      status: r.status,
      // three ways a day is recorded, and the office reads them differently:
      // proved at the centre, typed by the person from away, or put in for
      // them by an administrator
      entry: r.override_by_name ? `Manual · ${r.override_by_name}`
        : r.by_hand ? "Manual entry — away from centre"
        : "Geofenced",
      override_reason: r.override_reason ?? r.away_reason,
    })),
  };
}

/* --------------------------------------------------------------- students */

async function studentsByClass(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND e.center_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; class_name: string; total: string;
    boys: string; girls: string; other: string; mid_session: string;
  }>(
    `SELECT ce.name AS center_name, cl.name AS class_name,
            count(*) AS total,
            count(*) FILTER (WHERE s.gender = 'male')   AS boys,
            count(*) FILTER (WHERE s.gender = 'female') AS girls,
            count(*) FILTER (WHERE s.gender IS NULL OR s.gender = 'other') AS other,
            count(*) FILTER (WHERE e.source = 'mid_session') AS mid_session
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
      WHERE e.session_id = $1 AND e.status = 'active' AND s.status = 'active' ${where}
      GROUP BY ce.name, ce.code, cl.name, cl.sequence
      ORDER BY ce.code, cl.sequence`,
    params,
  );

  return {
    title: "Students by class and centre",
    subtitle: "Active enrolments in the selected session",
    columns: [
      { key: "center_name", label: "Centre", width: 20 },
      { key: "class_name", label: "Class", width: 14 },
      { key: "total", label: "Students", numeric: true },
      { key: "boys", label: "Boys", numeric: true },
      { key: "girls", label: "Girls", numeric: true },
      { key: "other", label: "Not recorded", numeric: true, width: 14 },
      { key: "mid_session", label: "Joined mid-session", numeric: true, width: 19 },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, class_name: r.class_name,
      total: Number(r.total), boys: Number(r.boys), girls: Number(r.girls),
      other: Number(r.other), mid_session: Number(r.mid_session),
    })),
  };
}

async function studentRoster(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND e.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND e.class_level_id = $${params.length}`; }

  const rows = await query<ReportRow>(
    `SELECT s.enrollment_no, trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
            cl.name AS class_name, e.section, e.roll_no, ce.name AS center_name,
            s.gender, s.dob::text AS dob, s.father_name, s.mother_name, s.primary_phone,
            s.admission_date::text AS admission_date, e.source, s.status,
            (SELECT round(100.0 * count(*) FILTER (WHERE a.status IN ${COUNTED})
                    / NULLIF(count(*) FILTER (WHERE a.${MARKED}), 0), 1)
               FROM student_attendance a WHERE a.enrollment_id = e.id) AS attendance_pct
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
      WHERE e.session_id = $1 ${where}
      ORDER BY ce.code, cl.sequence, student`,
    params,
  );

  return {
    title: "Student roster",
    subtitle: "Everyone enrolled in the selected session",
    columns: [
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 26 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "section", label: "Section", width: 9 },
      { key: "roll_no", label: "Roll", numeric: true },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "gender", label: "Gender", width: 10 },
      { key: "dob", label: "Date of birth", width: 14 },
      { key: "father_name", label: "Father", width: 22 },
      { key: "mother_name", label: "Mother", width: 22 },
      { key: "primary_phone", label: "Phone", width: 14 },
      { key: "admission_date", label: "Admitted", width: 13 },
      { key: "source", label: "Admission type", width: 16 },
      { key: "status", label: "Status", width: 12 },
      { key: "attendance_pct", label: "Attendance %", numeric: true, width: 14 },
    ],
    rows,
  };
}

async function admissions(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND e.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND e.class_level_id = $${params.length}`; }

  const rows = await query<ReportRow>(
    `SELECT e.enrolled_on::text AS enrolled_on, s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
            cl.name AS class_name, ce.name AS center_name, e.source,
            s.father_name, s.primary_phone, u.name AS admitted_by
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       LEFT JOIN users u ON u.id = s.created_by
      WHERE e.session_id = $1 AND e.enrolled_on BETWEEN $2 AND $3 ${where}
      ORDER BY e.enrolled_on DESC, ce.code, cl.sequence`,
    params,
  );

  return {
    title: "Admissions in the period",
    subtitle: period,
    columns: [
      { key: "enrolled_on", label: "Joined on", width: 13 },
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 26 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "source", label: "Type", width: 15 },
      { key: "father_name", label: "Father", width: 22 },
      { key: "primary_phone", label: "Phone", width: 14 },
      { key: "admitted_by", label: "Admitted by", width: 20 },
    ],
    rows,
  };
}

/* --------------------------------------------------------------- supplies */

async function suppliesStock(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where = ` AND c.id = $${params.length}`; }

  const rows = await query<{
    center_name: string; item: string; unit: string; category: string;
    received: string; issued: string;
  }>(
    `SELECT c.name AS center_name, i.name AS item, i.unit, i.category,
            COALESCE((SELECT sum(r.quantity) FROM center_supply_receipts r
                       WHERE r.item_id = i.id AND r.center_id = c.id), 0) AS received,
            COALESCE((SELECT sum(s.quantity) FROM student_supply_issues s
                       WHERE s.item_id = i.id AND s.center_id = c.id), 0) AS issued
       FROM centers c
       CROSS JOIN supply_items i
      WHERE c.is_active AND i.is_active ${where}
      ORDER BY c.code, i.category, i.name`,
    params,
  );

  return {
    title: "Supplies stock by centre",
    subtitle: "Received minus given out",
    columns: [
      { key: "center_name", label: "Centre", width: 20 },
      { key: "item", label: "Item", width: 24 },
      { key: "category", label: "Category", width: 14 },
      { key: "unit", label: "Unit", width: 10 },
      { key: "received", label: "Received", numeric: true },
      { key: "issued", label: "Given out", numeric: true, width: 12 },
      { key: "in_hand", label: "In hand", numeric: true },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, item: r.item, category: r.category, unit: r.unit,
      received: Number(r.received), issued: Number(r.issued),
      in_hand: Number(r.received) - Number(r.issued),
    })),
  };
}

async function hqStock(): Promise<ReportResult> {
  const rows = await query<{
    item: string; category: string; unit: string;
    received: string; dispatched: string; to_students: string;
  }>(
    `SELECT i.name AS item, i.category, i.unit,
            COALESCE((SELECT sum(h.quantity) FROM hq_supply_receipts h
                       WHERE h.item_id = i.id), 0) AS received,
            COALESCE((SELECT sum(r.quantity) FROM center_supply_receipts r
                       WHERE r.item_id = i.id), 0) AS dispatched,
            COALESCE((SELECT sum(s.quantity) FROM student_supply_issues s
                       WHERE s.item_id = i.id), 0) AS to_students
       FROM supply_items i WHERE i.is_active
      ORDER BY i.category, i.name`,
  );

  return {
    title: "Headquarters stock",
    subtitle: "The whole chain — received at HQ, sent to centres, given to students",
    columns: [
      { key: "item", label: "Item", width: 24 },
      { key: "category", label: "Category", width: 14 },
      { key: "unit", label: "Unit", width: 10 },
      { key: "received", label: "Received at HQ", numeric: true, width: 15 },
      { key: "dispatched", label: "Sent to centres", numeric: true, width: 16 },
      { key: "at_hq", label: "In hand at HQ", numeric: true, width: 15 },
      { key: "to_students", label: "Given to students", numeric: true, width: 17 },
      { key: "at_centres", label: "In hand at centres", numeric: true, width: 18 },
    ],
    rows: rows.map((r) => ({
      item: r.item, category: r.category, unit: r.unit,
      received: Number(r.received), dispatched: Number(r.dispatched),
      at_hq: Number(r.received) - Number(r.dispatched),
      to_students: Number(r.to_students),
      at_centres: Number(r.dispatched) - Number(r.to_students),
    })),
  };
}

/** Goods in at headquarters, consignment by consignment. */
async function hqReceipts(p: ReportParams, period: string): Promise<ReportResult> {
  const rows = await query<{
    received_on: string; item: string; category: string; unit: string;
    quantity: number; supplier: string | null; invoice_no: string | null;
    unit_cost: string | null; recorded_by: string | null; remarks: string | null;
  }>(
    `SELECT h.received_on::text AS received_on, i.name AS item, i.category, i.unit,
            h.quantity, h.supplier, h.invoice_no, h.unit_cost,
            u.name AS recorded_by, h.remarks
       FROM hq_supply_receipts h
       JOIN supply_items i ON i.id = h.item_id
       LEFT JOIN users u ON u.id = h.recorded_by
      WHERE h.received_on BETWEEN $1 AND $2
      ORDER BY h.received_on DESC, h.id DESC`,
    [p.from, p.to],
  );

  return {
    title: "Goods received at headquarters",
    subtitle: period,
    columns: [
      { key: "received_on", label: "Received on", width: 14 },
      { key: "item", label: "Item", width: 24 },
      { key: "category", label: "Category", width: 14 },
      { key: "quantity", label: "Quantity", numeric: true },
      { key: "unit", label: "Unit", width: 10 },
      { key: "supplier", label: "Supplier", width: 24 },
      { key: "invoice_no", label: "Invoice no.", width: 16 },
      { key: "unit_cost", label: "Unit cost", numeric: true, width: 12 },
      { key: "value", label: "Value", numeric: true, width: 12 },
      { key: "recorded_by", label: "Recorded by", width: 20 },
      { key: "remarks", label: "Remarks", width: 28 },
    ],
    rows: rows.map((r) => {
      const cost = r.unit_cost === null ? null : Number(r.unit_cost);
      return {
        received_on: r.received_on, item: r.item, category: titleCase(r.category),
        quantity: Number(r.quantity), unit: r.unit,
        supplier: r.supplier, invoice_no: r.invoice_no,
        unit_cost: cost,
        value: cost === null ? null : Math.round(cost * Number(r.quantity) * 100) / 100,
        recorded_by: r.recorded_by, remarks: r.remarks,
      };
    }),
  };
}

/** What headquarters sent out, centre by centre. */
async function suppliesDispatched(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where = ` AND r.center_id = $${params.length}`; }

  const rows = await query<{
    received_on: string; center_code: string; center_name: string; item: string;
    category: string; unit: string; quantity: number; challan_no: string | null;
    unit_cost: string | null; sent_by: string | null; remarks: string | null;
  }>(
    `SELECT r.received_on::text AS received_on, c.code AS center_code, c.name AS center_name,
            i.name AS item, i.category, i.unit, r.quantity, r.challan_no, r.unit_cost,
            COALESCE(d.name, u.name) AS sent_by, r.remarks
       FROM center_supply_receipts r
       JOIN supply_items i ON i.id = r.item_id
       JOIN centers c ON c.id = r.center_id
       LEFT JOIN users u ON u.id = r.recorded_by
       LEFT JOIN users d ON d.id = r.dispatched_by
      WHERE r.received_on BETWEEN $1 AND $2 ${where}
      ORDER BY r.received_on DESC, c.code, i.name`,
    params,
  );

  return {
    title: "Supplies sent to centres",
    subtitle: period,
    columns: [
      { key: "received_on", label: "Dispatched on", width: 15 },
      { key: "center_code", label: "Code", width: 9 },
      { key: "center_name", label: "Centre", width: 20 },
      { key: "item", label: "Item", width: 24 },
      { key: "category", label: "Category", width: 14 },
      { key: "quantity", label: "Quantity", numeric: true },
      { key: "unit", label: "Unit", width: 10 },
      { key: "challan_no", label: "Challan no.", width: 16 },
      { key: "unit_cost", label: "Unit cost", numeric: true, width: 12 },
      { key: "value", label: "Value", numeric: true, width: 12 },
      { key: "sent_by", label: "Sent by", width: 20 },
      { key: "remarks", label: "Remarks", width: 28 },
    ],
    rows: rows.map((r) => {
      const cost = r.unit_cost === null ? null : Number(r.unit_cost);
      return {
        received_on: r.received_on, center_code: r.center_code, center_name: r.center_name,
        item: r.item, category: titleCase(r.category),
        quantity: Number(r.quantity), unit: r.unit, challan_no: r.challan_no,
        unit_cost: cost,
        value: cost === null ? null : Math.round(cost * Number(r.quantity) * 100) / 100,
        sent_by: r.sent_by, remarks: r.remarks,
      };
    }),
  };
}

/** Where every item stands at every centre: sent, given out, still in hand. */
async function suppliesByCentre(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where = ` AND c.id = $${params.length}`; }

  const rows = await query<{
    center_code: string; center_name: string; item: string; category: string; unit: string;
    sent: string; to_students: string; students_served: string; last_sent: string | null;
  }>(
    `SELECT c.code AS center_code, c.name AS center_name, i.name AS item,
            i.category, i.unit,
            COALESCE((SELECT sum(r.quantity) FROM center_supply_receipts r
                       WHERE r.item_id = i.id AND r.center_id = c.id), 0) AS sent,
            COALESCE((SELECT sum(s.quantity) FROM student_supply_issues s
                       WHERE s.item_id = i.id AND s.center_id = c.id), 0) AS to_students,
            COALESCE((SELECT count(DISTINCT s.student_id) FROM student_supply_issues s
                       WHERE s.item_id = i.id AND s.center_id = c.id), 0) AS students_served,
            (SELECT max(r.received_on)::text FROM center_supply_receipts r
              WHERE r.item_id = i.id AND r.center_id = c.id) AS last_sent
       FROM centers c
       CROSS JOIN supply_items i
      WHERE c.is_active AND i.is_active ${where}
      ORDER BY c.code, i.category, i.name`,
    params,
  );

  return {
    title: "Centre-wise supply position",
    subtitle: "Sent from headquarters, given to students, and what remains",
    columns: [
      { key: "center_code", label: "Code", width: 9 },
      { key: "center_name", label: "Centre", width: 20 },
      { key: "item", label: "Item", width: 24 },
      { key: "category", label: "Category", width: 14 },
      { key: "unit", label: "Unit", width: 10 },
      { key: "sent", label: "Sent to centre", numeric: true, width: 15 },
      { key: "to_students", label: "Given to students", numeric: true, width: 17 },
      { key: "in_hand", label: "In hand", numeric: true, width: 11 },
      { key: "students_served", label: "Students served", numeric: true, width: 16 },
      { key: "last_sent", label: "Last dispatch", width: 14 },
    ],
    rows: rows.map((r) => ({
      center_code: r.center_code, center_name: r.center_name, item: r.item,
      category: titleCase(r.category), unit: r.unit,
      sent: Number(r.sent), to_students: Number(r.to_students),
      in_hand: Number(r.sent) - Number(r.to_students),
      students_served: Number(r.students_served),
      last_sent: r.last_sent,
    })),
  };
}

async function suppliesIssued(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where = ` AND s.center_id = $${params.length}`; }

  const rows = await query<ReportRow>(
    `SELECT s.issued_on::text AS issued_on, c.name AS center_name,
            st.enrollment_no, trim(st.first_name || ' ' || COALESCE(st.last_name,'')) AS student,
            cl.name AS class_name, i.name AS item, i.unit, s.quantity,
            u.name AS issued_by, s.remarks
       FROM student_supply_issues s
       JOIN supply_items i ON i.id = s.item_id
       JOIN students st ON st.id = s.student_id
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = st.id AND e.session_id = s.session_id
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
       LEFT JOIN users u ON u.id = s.issued_by
      WHERE s.issued_on BETWEEN $1 AND $2 ${where}
      ORDER BY s.issued_on DESC, c.code, student`,
    params,
  );

  return {
    title: "Supplies given to students",
    subtitle: period,
    columns: [
      { key: "issued_on", label: "Date", width: 13 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 24 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "item", label: "Item", width: 22 },
      { key: "quantity", label: "Qty", numeric: true },
      { key: "unit", label: "Unit", width: 10 },
      { key: "issued_by", label: "Issued by", width: 20 },
      { key: "remarks", label: "Remarks", width: 28 },
    ],
    rows,
  };
}

/* ------------------------------------------------------------------ tests */

async function examMarks(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND x.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND x.class_level_id = $${params.length}`; }

  const rows = await query<{
    exam_date: string; title: string; subject: string; exam_type: string;
    center_name: string; class_name: string; enrollment_no: string; student: string;
    max_marks: string; marks_obtained: string | null; is_absent: boolean;
  }>(
    `SELECT x.exam_date::text AS exam_date, x.title, x.subject, x.exam_type,
            ce.name AS center_name, cl.name AS class_name,
            s.enrollment_no, trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
            x.max_marks, m.marks_obtained, m.is_absent
       FROM exam_marks m
       JOIN exams x ON x.id = m.exam_id
       JOIN students s ON s.id = m.student_id
       JOIN centers ce ON ce.id = x.center_id
       JOIN class_levels cl ON cl.id = x.class_level_id
      WHERE x.session_id = $1 AND x.exam_date BETWEEN $2 AND $3 ${where}
      ORDER BY x.exam_date DESC, ce.code, cl.sequence, student`,
    params,
  );

  const GRADE = (pct: number | null) => {
    if (pct === null) return "—";
    if (pct >= 90) return "A+"; if (pct >= 80) return "A"; if (pct >= 70) return "B+";
    if (pct >= 60) return "B";  if (pct >= 50) return "C"; if (pct >= 40) return "D";
    return "E";
  };

  return {
    title: "Marks sheet",
    subtitle: period,
    columns: [
      { key: "exam_date", label: "Date", width: 13 },
      { key: "title", label: "Test", width: 24 },
      { key: "subject", label: "Subject", width: 16 },
      { key: "exam_type", label: "Type", width: 14 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 24 },
      { key: "max_marks", label: "Max", numeric: true },
      { key: "obtained", label: "Obtained", numeric: true, width: 11 },
      { key: "pct", label: "%", numeric: true },
      { key: "grade", label: "Grade", width: 9 },
    ],
    rows: rows.map((r) => {
      const max = Number(r.max_marks);
      const obtained = r.is_absent || r.marks_obtained === null ? null : Number(r.marks_obtained);
      const p2 = obtained === null ? null : Math.round((obtained / max) * 1000) / 10;
      return {
        exam_date: r.exam_date, title: r.title, subject: r.subject,
        exam_type: r.exam_type.replace(/_/g, " "),
        center_name: r.center_name, class_name: r.class_name,
        enrollment_no: r.enrollment_no, student: r.student,
        max_marks: max,
        obtained: r.is_absent ? "Absent" : obtained,
        pct: p2, grade: GRADE(p2),
      };
    }),
  };
}

async function examSummary(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND x.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND x.class_level_id = $${params.length}`; }

  const rows = await query<{
    exam_date: string; title: string; subject: string; exam_type: string;
    center_name: string; class_name: string; max_marks: string; pass_marks: string | null;
    graded: string; absent: string; average: string | null;
    highest: string | null; lowest: string | null; passed: string | null; status: string;
  }>(
    `SELECT x.exam_date::text AS exam_date, x.title, x.subject, x.exam_type,
            ce.name AS center_name, cl.name AS class_name, x.max_marks, x.pass_marks, x.status,
            count(m.*) FILTER (WHERE m.marks_obtained IS NOT NULL) AS graded,
            count(m.*) FILTER (WHERE m.is_absent) AS absent,
            round(avg(m.marks_obtained), 1) AS average,
            max(m.marks_obtained) AS highest,
            min(m.marks_obtained) AS lowest,
            count(m.*) FILTER (
              WHERE x.pass_marks IS NOT NULL AND m.marks_obtained >= x.pass_marks) AS passed
       FROM exams x
       JOIN centers ce ON ce.id = x.center_id
       JOIN class_levels cl ON cl.id = x.class_level_id
       LEFT JOIN exam_marks m ON m.exam_id = x.id
      WHERE x.session_id = $1 AND x.exam_date BETWEEN $2 AND $3 ${where}
      GROUP BY x.id, ce.name, ce.code, cl.name, cl.sequence
      ORDER BY x.exam_date DESC, ce.code, cl.sequence`,
    params,
  );

  return {
    title: "Test summary",
    subtitle: period,
    columns: [
      { key: "exam_date", label: "Date", width: 13 },
      { key: "title", label: "Test", width: 26 },
      { key: "subject", label: "Subject", width: 16 },
      { key: "exam_type", label: "Type", width: 14 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "max_marks", label: "Max", numeric: true },
      { key: "graded", label: "Graded", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "average", label: "Average", numeric: true, width: 11 },
      { key: "average_pct", label: "Average %", numeric: true, width: 12 },
      { key: "highest", label: "Highest", numeric: true },
      { key: "lowest", label: "Lowest", numeric: true },
      { key: "passed", label: "Passed", numeric: true },
      { key: "status", label: "Status", width: 12 },
    ],
    rows: rows.map((r) => {
      const max = Number(r.max_marks);
      const avg = r.average === null ? null : Number(r.average);
      return {
        exam_date: r.exam_date, title: r.title, subject: r.subject,
        exam_type: r.exam_type.replace(/_/g, " "),
        center_name: r.center_name, class_name: r.class_name,
        max_marks: max,
        graded: Number(r.graded), absent: Number(r.absent),
        average: avg,
        average_pct: avg === null ? null : Math.round((avg / max) * 1000) / 10,
        highest: r.highest === null ? null : Number(r.highest),
        lowest: r.lowest === null ? null : Number(r.lowest),
        passed: r.pass_marks === null ? null : Number(r.passed),
        status: r.status,
      };
    }),
  };
}

/* -------------------------------------------------------------------- PTM */

async function ptmSummary(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId, p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND i.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND i.class_level_id = $${params.length}`; }

  const rows = await query<ReportRow>(
    `SELECT i.interaction_date::text AS interaction_date, ce.name AS center_name,
            cl.name AS class_name, st.enrollment_no,
            trim(st.first_name || ' ' || COALESCE(st.last_name,'')) AS student,
            u.name AS mentor, i.parent_present, i.engagement, i.mode,
            i.attendance_pct, i.marks_pct,
            CASE WHEN i.follow_up_required THEN i.follow_up_status ELSE '—' END AS follow_up,
            i.follow_up_date::text AS follow_up_date, i.concerns,
            array_to_string(i.concern_tags, ', ') AS concern_tags,
            array_to_string(i.commitment_tags, ', ') AS commitment_tags,
            i.follow_up_priority, i.follow_up_owner, i.confidence, i.support_needed,
            asg.name AS assigned_to,
            -- the day the meeting was typed in, and how long after it happened:
            -- a week-old write-up is a different kind of record from a same-day one
            to_char(i.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS written_on,
            ((i.created_at AT TIME ZONE 'Asia/Kolkata')::date - i.interaction_date) AS days_later
       FROM ptm_interactions i
       JOIN students st ON st.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN users asg ON asg.id = i.follow_up_assignee_id
      WHERE i.session_id = $1 AND i.interaction_date BETWEEN $2 AND $3 ${where}
      ORDER BY i.interaction_date DESC, ce.code`,
    params,
  );

  return {
    title: "PTM and follow-ups",
    subtitle: period,
    columns: [
      { key: "interaction_date", label: "Meeting on", width: 13 },
      { key: "written_on", label: "Written up on", width: 14 },
      { key: "days_later", label: "Days later", numeric: true, width: 11 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 24 },
      { key: "mentor", label: "Mentor", width: 20 },
      { key: "parent_present", label: "Parent present", width: 15 },
      { key: "engagement", label: "Engagement", width: 13 },
      { key: "mode", label: "Mode", width: 12 },
      { key: "attendance_pct", label: "Attendance %", numeric: true, width: 14 },
      { key: "marks_pct", label: "Marks %", numeric: true, width: 11 },
      { key: "concern_tags", label: "Concerns discussed", width: 34 },
      { key: "commitment_tags", label: "Parent commitments", width: 34 },
      { key: "confidence", label: "Confidence", numeric: true, width: 12 },
      { key: "follow_up", label: "Follow-up", width: 12 },
      { key: "follow_up_priority", label: "Priority", width: 11 },
      { key: "follow_up_date", label: "Follow-up on", width: 14 },
      { key: "follow_up_owner", label: "Owner", width: 16 },
      { key: "assigned_to", label: "Assigned to", width: 20 },
      { key: "concerns", label: "Other concern", width: 26 },
      { key: "support_needed", label: "Support needed", width: 30 },
    ],
    rows,
  };
}

/* --------------------------------------------------------------- teaching */

async function teachingPlanProgress(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND pl.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND pl.class_level_id = $${params.length}`; }

  const rows = await query<{
    title: string; subject: string | null; class_name: string; teacher: string;
    center_name: string; status: string; submitted_at: string | null;
    starts_on: string | null; ends_on: string | null;
    topics: string; taught: string; issues: string;
  }>(
    `SELECT pl.title, pl.subject, cl.name AS class_name, u.name AS teacher,
            ce.name AS center_name, pl.status,
            to_char(pl.submitted_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY') AS submitted_at,
            pl.starts_on::text AS starts_on, pl.ends_on::text AS ends_on,
            (SELECT count(*) FROM teaching_plan_topics t WHERE t.plan_id = pl.id) AS topics,
            (SELECT count(*) FROM teaching_plan_topics t
              WHERE t.plan_id = pl.id AND t.status = 'completed') AS taught,
            (SELECT count(*) FROM teaching_plan_topics t
              WHERE t.plan_id = pl.id AND t.issues_faced IS NOT NULL) AS issues
       FROM teaching_plans pl
       JOIN class_levels cl ON cl.id = pl.class_level_id
       JOIN users u ON u.id = pl.teacher_id
       JOIN centers ce ON ce.id = pl.center_id
      WHERE pl.session_id = $1 ${where}
      ORDER BY ce.code, cl.sequence, pl.created_at DESC`,
    params,
  );

  return {
    title: "Teaching plan progress",
    subtitle: "Plans in the selected session",
    columns: [
      { key: "title", label: "Plan", width: 28 },
      { key: "subject", label: "Subject", width: 16 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "teacher", label: "Teacher", width: 22 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "status", label: "Status", width: 12 },
      { key: "submitted_at", label: "Submitted", width: 14 },
      { key: "starts_on", label: "Starts", width: 12 },
      { key: "ends_on", label: "Ends", width: 12 },
      { key: "topics", label: "Topics", numeric: true },
      { key: "taught", label: "Taught", numeric: true },
      { key: "progress_pct", label: "Progress %", numeric: true, width: 12 },
      { key: "issues", label: "Issues logged", numeric: true, width: 14 },
    ],
    rows: rows.map((r) => ({
      title: r.title, subject: r.subject, class_name: r.class_name, teacher: r.teacher,
      center_name: r.center_name, status: r.status, submitted_at: r.submitted_at,
      starts_on: r.starts_on, ends_on: r.ends_on,
      topics: Number(r.topics), taught: Number(r.taught),
      progress_pct: pct(Number(r.taught), Number(r.topics)),
      issues: Number(r.issues),
    })),
  };
}

async function timetableReport(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND t.center_id = $${params.length}`; }
  if (p.classId) { params.push(p.classId); where += ` AND t.class_level_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; class_name: string; day_of_week: number; period_no: number;
    start_time: string; end_time: string; subject: string; teacher: string | null; room: string | null;
  }>(
    `SELECT ce.name AS center_name, cl.name AS class_name, t.day_of_week, t.period_no,
            t.start_time::text AS start_time, t.end_time::text AS end_time,
            t.subject, u.name AS teacher, t.room
       FROM timetable_slots t
       JOIN class_levels cl ON cl.id = t.class_level_id
       JOIN centers ce ON ce.id = t.center_id
       LEFT JOIN users u ON u.id = t.teacher_id
      WHERE t.session_id = $1 ${where}
      ORDER BY ce.code, cl.sequence, t.day_of_week, t.period_no`,
    params,
  );

  const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return {
    title: "Timetable",
    subtitle: "Weekly plan for the selected session",
    columns: [
      { key: "center_name", label: "Centre", width: 18 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "day", label: "Day", width: 12 },
      { key: "period_no", label: "Period", numeric: true },
      { key: "start_time", label: "From", width: 10 },
      { key: "end_time", label: "To", width: 10 },
      { key: "subject", label: "Subject", width: 20 },
      { key: "teacher", label: "Teacher", width: 22 },
      { key: "room", label: "Room", width: 12 },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, class_name: r.class_name,
      day: DAYS[r.day_of_week] ?? String(r.day_of_week),
      period_no: r.period_no,
      start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5),
      subject: r.subject, teacher: r.teacher, room: r.room,
    })),
  };
}


/* ------------------------------------------------------------- who left, and why */

/**
 * Every child taken off the roll in the period.
 *
 * Only administrators can mark a child dropped, and only administrators can read
 * this — the point of both is that a centre cannot quietly shrink the roll it is
 * measured on. The name of whoever recorded it is part of the row for the same
 * reason.
 */
async function dropouts(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND s.center_id = $${params.length}`; }
  if (p.classId) {
    params.push(p.classId);
    where += ` AND EXISTS (SELECT 1 FROM enrollments e
                            WHERE e.student_id = s.id AND e.class_level_id = $${params.length})`;
  }

  const rows = await query<ReportRow>(
    `SELECT s.dropout_date::text AS dropout_date, s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
            ce.name AS center_name,
            (SELECT cl.name FROM enrollments e
               JOIN class_levels cl ON cl.id = e.class_level_id
              WHERE e.student_id = s.id ORDER BY e.id DESC LIMIT 1) AS class_name,
            s.dropout_reason, s.dropout_remarks,
            s.father_name, s.primary_phone,
            u.name AS marked_by, s.dropout_marked_at::date::text AS marked_on
       FROM students s
       JOIN centers ce ON ce.id = s.center_id
       LEFT JOIN users u ON u.id = s.dropout_marked_by
      WHERE s.status = 'dropped'
        AND COALESCE(s.dropout_date, s.dropout_marked_at::date) BETWEEN $1 AND $2 ${where}
      ORDER BY s.dropout_date DESC NULLS LAST, ce.code`,
    params,
  );

  return {
    title: "Children who left",
    subtitle: period,
    columns: [
      { key: "dropout_date", label: "Left on", width: 13 },
      { key: "enrollment_no", label: "Enrolment No", width: 16 },
      { key: "student", label: "Student", width: 24 },
      { key: "class_name", label: "Class", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "dropout_reason", label: "Reason", width: 28 },
      { key: "dropout_remarks", label: "Remarks", width: 36 },
      { key: "father_name", label: "Father", width: 20 },
      { key: "primary_phone", label: "Phone", width: 14 },
      { key: "marked_by", label: "Recorded by", width: 20 },
      { key: "marked_on", label: "Recorded on", width: 13 },
    ],
    rows,
  };
}

/** The same departures counted by reason, so the pattern is visible at a glance. */
async function dropoutReasons(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND s.center_id = $${params.length}`; }

  const rows = await query<ReportRow>(
    `SELECT COALESCE(s.dropout_reason, 'Not recorded') AS reason,
            ce.name AS center_name,
            count(*)::int AS children
       FROM students s
       JOIN centers ce ON ce.id = s.center_id
      WHERE s.status = 'dropped'
        AND COALESCE(s.dropout_date, s.dropout_marked_at::date) BETWEEN $1 AND $2 ${where}
      GROUP BY 1, 2
      ORDER BY count(*) DESC, 1`,
    params,
  );

  return {
    title: "Why children leave",
    subtitle: period,
    columns: [
      { key: "reason", label: "Reason", width: 32 },
      { key: "center_name", label: "Centre", width: 18 },
      { key: "children", label: "Children", width: 10, numeric: true },
    ],
    rows,
  };
}

/* ------------------------------------------------------------------ sports */

const SPORT_LEVEL: Record<string, string> = {
  centre: "Stands out at the centre", district: "District level",
  state: "State level", national: "National level",
};

/** Turnout across every session a child has been marked for, per sport. */
const TURNOUT = `
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE a.status = 'present') AS present, count(*) AS marked
      FROM sport_attendance a
     WHERE a.sport_id = ss.sport_id AND a.student_id = ss.student_id
  ) t ON TRUE`;

async function sportsPlayers(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND sp.center_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; sport: string; student: string; enrollment_no: string;
    class_name: string | null; gender: string | null; joined_on: string;
    present: string; marked: string; is_special: boolean; speciality: string | null;
    special_level: string | null; remarks: string | null;
  }>(
    `SELECT c.name AS center_name, sp.name AS sport, ss.remarks,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, cl.name AS class_name, s.gender, ss.joined_on,
            t.present, t.marked, ss.is_special, ss.speciality, ss.special_level
       FROM sport_students ss
       JOIN sports sp ON sp.id = ss.sport_id
       JOIN centers c ON c.id = sp.center_id
       JOIN students s ON s.id = ss.student_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
       ${TURNOUT}
      WHERE ss.left_on IS NULL AND s.status = 'active' ${where}
      ORDER BY c.code, sp.name, cl.sequence NULLS LAST, student`,
    params,
  );

  return {
    title: "Children in sports",
    subtitle: `${rows.length} place${rows.length === 1 ? "" : "s"} across the sports — a child in two sports is listed twice`,
    columns: [
      { key: "center_name", label: "Centre", width: 16 },
      { key: "sport", label: "Sport", width: 14 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "class_name", label: "Class", width: 10 },
      { key: "gender", label: "Gender", width: 9 },
      { key: "joined_on", label: "Joined", width: 12 },
      { key: "sessions", label: "Sessions marked", numeric: true, width: 10 },
      { key: "turnout", label: "Turnout %", numeric: true, width: 10 },
      { key: "talent", label: "Talent", width: 28 },
      { key: "level", label: "Could go to", width: 20 },
      { key: "remarks", label: "Sports teacher's remark", width: 36 },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, sport: r.sport, student: r.student,
      enrollment_no: r.enrollment_no, class_name: r.class_name ?? "—",
      gender: r.gender ? titleCase(r.gender) : "—",
      joined_on: String(r.joined_on).slice(0, 10),
      sessions: Number(r.marked),
      turnout: Number(r.marked) ? pct(Number(r.present), Number(r.marked)) : null,
      talent: r.is_special ? r.speciality : "",
      level: r.is_special && r.special_level ? SPORT_LEVEL[r.special_level] : "",
      remarks: r.remarks ?? "",
    })),
  };
}

async function sportsAttendance(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND sp.center_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; sport: string; student: string; enrollment_no: string;
    present: string; absent: string;
  }>(
    `SELECT c.name AS center_name, sp.name AS sport,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no,
            count(*) FILTER (WHERE a.status = 'present') AS present,
            count(*) FILTER (WHERE a.status = 'absent')  AS absent
       FROM sport_attendance a
       JOIN sports sp ON sp.id = a.sport_id
       JOIN centers c ON c.id = sp.center_id
       JOIN students s ON s.id = a.student_id
      WHERE a.att_date BETWEEN $1 AND $2 ${where}
      GROUP BY c.code, c.name, sp.name, s.id
      ORDER BY c.code, sp.name, student`,
    params,
  );

  return {
    title: "Sports attendance",
    subtitle: `${period} · one row per child per sport`,
    columns: [
      { key: "center_name", label: "Centre", width: 16 },
      { key: "sport", label: "Sport", width: 14 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "present", label: "Present", numeric: true },
      { key: "absent", label: "Absent", numeric: true },
      { key: "sessions", label: "Sessions", numeric: true },
      { key: "turnout", label: "Turnout %", numeric: true, width: 10 },
    ],
    rows: rows.map((r) => {
      const present = Number(r.present), absent = Number(r.absent);
      return {
        center_name: r.center_name, sport: r.sport, student: r.student,
        enrollment_no: r.enrollment_no, present, absent, sessions: present + absent,
        turnout: pct(present, present + absent),
      };
    }),
  };
}

async function sportsMarks(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND sp.center_id = $${params.length}`; }

  const rows = await query<{
    test_date: string; center_name: string; sport: string; test: string; student: string;
    enrollment_no: string; marks: string | null; max_marks: string; is_absent: boolean;
    remarks: string | null;
  }>(
    `SELECT t.test_date, c.name AS center_name, sp.name AS sport, t.title AS test,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, m.marks, t.max_marks, m.is_absent, m.remarks
       FROM sport_marks m
       JOIN sport_tests t ON t.id = m.test_id
       JOIN sports sp ON sp.id = t.sport_id
       JOIN centers c ON c.id = sp.center_id
       JOIN students s ON s.id = m.student_id
      WHERE t.test_date BETWEEN $1 AND $2 ${where}
      ORDER BY t.test_date DESC, c.code, sp.name, t.title, student`,
    params,
  );

  return {
    title: "Sports tests and marks",
    subtitle: `${period} · ${rows.length} result${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "test_date", label: "Date", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "sport", label: "Sport", width: 14 },
      { key: "test", label: "Test", width: 20 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "marks", label: "Marks", numeric: true },
      { key: "max_marks", label: "Out of", numeric: true },
      { key: "percent", label: "%", numeric: true },
      { key: "remarks", label: "Remarks", width: 40 },
    ],
    rows: rows.map((r) => ({
      test_date: String(r.test_date).slice(0, 10), center_name: r.center_name,
      sport: r.sport, test: r.test, student: r.student, enrollment_no: r.enrollment_no,
      marks: r.is_absent ? "Absent" : r.marks == null ? null : Number(r.marks),
      max_marks: Number(r.max_marks),
      percent: r.is_absent || r.marks == null ? null : pct(Number(r.marks), Number(r.max_marks)),
      remarks: r.remarks ?? "",
    })),
  };
}

async function sportsTalent(p: ReportParams): Promise<ReportResult> {
  const params: unknown[] = [p.sessionId];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND sp.center_id = $${params.length}`; }

  const rows = await query<{
    center_name: string; sport: string; student: string; enrollment_no: string;
    class_name: string | null; speciality: string | null; special_level: string | null;
    marked_by: string | null; marked_at: string | null; present: string; marked: string;
    best: string | null;
  }>(
    `SELECT c.name AS center_name, sp.name AS sport,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, cl.name AS class_name, ss.speciality, ss.special_level,
            u.name AS marked_by,
            to_char(ss.special_marked_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS marked_at,
            t.present, t.marked,
            (SELECT max(round(100.0 * m.marks / st.max_marks, 1))
               FROM sport_marks m JOIN sport_tests st ON st.id = m.test_id
              WHERE st.sport_id = ss.sport_id AND m.student_id = ss.student_id
                AND m.marks IS NOT NULL) AS best
       FROM sport_students ss
       JOIN sports sp ON sp.id = ss.sport_id
       JOIN centers c ON c.id = sp.center_id
       JOIN students s ON s.id = ss.student_id
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.session_id = $1
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
       LEFT JOIN users u ON u.id = ss.special_marked_by
       ${TURNOUT}
      WHERE ss.is_special AND ss.left_on IS NULL ${where}
      ORDER BY array_position(ARRAY['national','state','district','centre'], ss.special_level),
               c.code, sp.name, student`,
    params,
  );

  return {
    title: "Sporting talent",
    subtitle: `${rows.length} child${rows.length === 1 ? "" : "ren"} marked as specially gifted, the strongest first`,
    columns: [
      { key: "center_name", label: "Centre", width: 16 },
      { key: "sport", label: "Sport", width: 14 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "class_name", label: "Class", width: 10 },
      { key: "speciality", label: "Talent", width: 30 },
      { key: "level", label: "Could go to", width: 20 },
      { key: "turnout", label: "Turnout %", numeric: true, width: 10 },
      { key: "best", label: "Best test %", numeric: true, width: 11 },
      { key: "marked_by", label: "Marked by", width: 18 },
      { key: "marked_on", label: "Marked on", width: 12 },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, sport: r.sport, student: r.student,
      enrollment_no: r.enrollment_no, class_name: r.class_name ?? "—",
      speciality: r.speciality ?? "",
      level: r.special_level ? SPORT_LEVEL[r.special_level] : "",
      turnout: Number(r.marked) ? pct(Number(r.present), Number(r.marked)) : null,
      best: r.best == null ? null : Number(r.best),
      marked_by: r.marked_by ?? "", marked_on: r.marked_at ?? "",
    })),
  };
}

const IST_TIME = (col: string) => `to_char(${col} AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')`;

async function sportsVisits(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND v.center_id = $${params.length}`; }

  const rows = await query<{
    visit_date: string; teacher: string; center_name: string; check_in: string;
    check_out: string | null; worked_minutes: number | null; check_in_distance_m: number | null;
    sports_covered: string[]; children_count: number | null; activities: string | null;
    highlights: string | null; issues: string | null; submitted: boolean; closed_late: boolean;
  }>(
    `SELECT v.visit_date, u.name AS teacher, c.name AS center_name,
            ${IST_TIME("v.check_in_at")} AS check_in, ${IST_TIME("v.check_out_at")} AS check_out,
            v.worked_minutes, v.check_in_distance_m, v.sports_covered, v.children_count,
            v.activities, v.highlights, v.issues,
            (v.report_submitted_at IS NOT NULL) AS submitted, v.closed_late
       FROM sports_visits v
       JOIN users u ON u.id = v.user_id
       JOIN centers c ON c.id = v.center_id
      WHERE v.visit_date BETWEEN $1 AND $2 ${where}
      ORDER BY v.visit_date DESC, u.name, v.check_in_at`,
    params,
  );

  return {
    title: "Sports teacher visits",
    subtitle: `${period} · ${rows.length} visit${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "visit_date", label: "Date", width: 12 },
      { key: "teacher", label: "Sports teacher", width: 18 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "check_in", label: "In", width: 10 },
      { key: "check_out", label: "Out", width: 10 },
      { key: "hours", label: "Time at centre", width: 12 },
      { key: "distance", label: "Distance (m)", numeric: true, width: 11 },
      { key: "sports", label: "Sports played", width: 22 },
      { key: "children", label: "Children", numeric: true },
      { key: "activities", label: "What was done", width: 44 },
      { key: "highlights", label: "Highlights", width: 30 },
      { key: "issues", label: "Problems", width: 30 },
      { key: "report", label: "Report", width: 14 },
    ],
    rows: rows.map((r) => ({
      visit_date: String(r.visit_date).slice(0, 10), teacher: r.teacher,
      center_name: r.center_name, check_in: r.check_in,
      check_out: r.check_out ?? (r.closed_late ? "not recorded" : "still there"),
      hours: r.worked_minutes == null ? "" : `${Math.floor(r.worked_minutes / 60)}h ${r.worked_minutes % 60}m`,
      distance: r.check_in_distance_m, sports: r.sports_covered.join(", "),
      children: r.children_count, activities: r.activities ?? "",
      highlights: r.highlights ?? "", issues: r.issues ?? "",
      report: !r.submitted ? "Not submitted" : r.closed_late ? "Submitted late" : "Submitted",
    })),
  };
}

async function sportsTeacherDays(p: ReportParams, period: string): Promise<ReportResult> {
  const rows = await query<{
    visit_date: string; teacher: string; centres: number; route: string;
    first_in: string; last_out: string | null; minutes: number | null; pending: number;
    children: number | null;
  }>(
    `SELECT v.visit_date, u.name AS teacher,
            count(*)::int AS centres,
            string_agg(c.name, ' → ' ORDER BY v.check_in_at) AS route,
            ${IST_TIME("min(v.check_in_at)")} AS first_in,
            ${IST_TIME("max(v.check_out_at)")} AS last_out,
            sum(v.worked_minutes)::int AS minutes,
            count(*) FILTER (WHERE v.report_submitted_at IS NULL)::int AS pending,
            sum(v.children_count)::int AS children
       FROM sports_visits v
       JOIN users u ON u.id = v.user_id
       JOIN centers c ON c.id = v.center_id
      WHERE v.visit_date BETWEEN $1 AND $2
      GROUP BY v.visit_date, u.id, u.name
      ORDER BY v.visit_date DESC, u.name`,
    [p.from, p.to],
  );

  return {
    title: "Sports teacher — day by day",
    subtitle: period,
    columns: [
      { key: "visit_date", label: "Date", width: 12 },
      { key: "teacher", label: "Sports teacher", width: 18 },
      { key: "centres", label: "Centres", numeric: true },
      { key: "route", label: "Where, in order", width: 40 },
      { key: "first_in", label: "First in", width: 10 },
      { key: "last_out", label: "Last out", width: 10 },
      { key: "hours", label: "Hours at centres", width: 13 },
      { key: "children", label: "Children", numeric: true },
      { key: "pending", label: "Reports missing", numeric: true, width: 12 },
    ],
    rows: rows.map((r) => ({
      visit_date: String(r.visit_date).slice(0, 10), teacher: r.teacher, centres: r.centres,
      route: r.route, first_in: r.first_in, last_out: r.last_out ?? "",
      hours: r.minutes == null ? "" : `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m`,
      children: r.children, pending: r.pending,
    })),
  };
}

/* --------------------------------------------------------------- transfers */

/** A centre filter matches a transfer at either end — the children who left it and who arrived. */
async function studentTransfers(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) {
    params.push(p.centerId);
    where = ` AND (t.from_center_id = $${params.length} OR t.to_center_id = $${params.length})`;
  }
  const rows = await query<{
    transferred_on: string; student: string; enrollment_no: string; from_centre: string;
    to_centre: string; from_class: string | null; to_class: string | null; reason: string | null;
    moved_history: boolean; moved_attendance: number; moved_ptm: number; moved_referrals: number;
    left_sports: number; by_name: string | null;
  }>(
    `SELECT t.transferred_on, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, fc.name AS from_centre, tc.name AS to_centre,
            fcl.name AS from_class, tcl.name AS to_class, t.reason, t.moved_history,
            t.moved_attendance, t.moved_ptm, t.moved_referrals, t.left_sports, u.name AS by_name
       FROM student_transfers t
       JOIN students s ON s.id = t.student_id
       JOIN centers fc ON fc.id = t.from_center_id
       JOIN centers tc ON tc.id = t.to_center_id
       LEFT JOIN class_levels fcl ON fcl.id = t.from_class_id
       LEFT JOIN class_levels tcl ON tcl.id = t.to_class_id
       LEFT JOIN users u ON u.id = t.transferred_by
      WHERE t.transferred_on BETWEEN $1 AND $2 ${where}
      ORDER BY t.transferred_on DESC, t.id DESC`,
    params,
  );
  return {
    title: "Transfers between centres",
    subtitle: `${period} · ${rows.length} transfer${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "transferred_on", label: "Date", width: 12 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "from_centre", label: "From centre", width: 16 },
      { key: "to_centre", label: "To centre", width: 16 },
      { key: "from_class", label: "Class before", width: 12 },
      { key: "to_class", label: "Class after", width: 12 },
      { key: "reason", label: "Reason", width: 30 },
      { key: "moved", label: "Records moved", width: 34 },
      { key: "by_name", label: "Transferred by", width: 18 },
    ],
    rows: rows.map((r) => ({
      transferred_on: String(r.transferred_on).slice(0, 10), student: r.student,
      enrollment_no: r.enrollment_no, from_centre: r.from_centre, to_centre: r.to_centre,
      from_class: r.from_class ?? "—", to_class: r.to_class ?? "—", reason: r.reason ?? "",
      moved: r.moved_history
        ? `${r.moved_attendance} attendance days, ${r.moved_referrals} referrals`
        : `Open items only (${r.moved_referrals} referrals)`,
      by_name: r.by_name ?? "",
    })),
  };
}

/* ------------------------------------------------ suspended and passed out */

async function offRoll(p: ReportParams, status: "suspended" | "graduated"): Promise<ReportResult> {
  const params: unknown[] = [status];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND s.center_id = $${params.length}`; }
  const rows = await query<{
    student: string; enrollment_no: string; admission_no: string | null; gender: string | null;
    father_name: string | null; primary_phone: string | null; center_name: string;
    class_name: string | null; left_on: string | null; left_reason: string | null;
  }>(
    `SELECT trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, s.admission_no, s.gender, s.father_name, s.primary_phone,
            c.name AS center_name, cl.name AS class_name, s.left_on, s.left_reason
       FROM students s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN LATERAL (
         SELECT e.class_level_id FROM enrollments e
          WHERE e.student_id = s.id ORDER BY e.session_id DESC LIMIT 1
       ) last ON TRUE
       LEFT JOIN class_levels cl ON cl.id = last.class_level_id
      WHERE s.status = $1 ${where}
      ORDER BY c.code, cl.sequence NULLS LAST, student`,
    params,
  );
  const passed = status === "graduated";
  return {
    title: passed ? "Passed out students" : "Suspended students",
    subtitle: `${rows.length} child${rows.length === 1 ? "" : "ren"}`,
    columns: [
      { key: "center_name", label: "Last centre", width: 16 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "admission_no", label: "Admission No", width: 12 },
      { key: "class_name", label: "Last class", width: 11 },
      { key: "gender", label: "Gender", width: 9 },
      { key: "father_name", label: "Father", width: 20 },
      { key: "primary_phone", label: "Phone", width: 13 },
      { key: "left_on", label: "Since", width: 12 },
      { key: "left_reason", label: passed ? "Went to" : "Reason", width: 44 },
    ],
    rows: rows.map((r) => ({
      center_name: r.center_name, student: r.student, enrollment_no: r.enrollment_no,
      admission_no: r.admission_no ?? "", class_name: r.class_name ?? "—",
      gender: r.gender ? titleCase(r.gender) : "—", father_name: r.father_name ?? "",
      primary_phone: r.primary_phone ?? "", left_on: r.left_on ? String(r.left_on).slice(0, 10) : "",
      left_reason: r.left_reason ?? "",
    })),
  };
}

async function reactivations(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) {
    params.push(p.centerId);
    where = ` AND (r.from_center_id = $${params.length} OR r.to_center_id = $${params.length})`;
  }
  const rows = await query<{
    reactivated_on: string; student: string; enrollment_no: string; from_status: string;
    from_centre: string | null; to_centre: string; from_class: string | null; to_class: string;
    left_reason: string | null; note: string | null; by_name: string | null;
  }>(
    `SELECT r.reactivated_on, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, r.from_status, fc.name AS from_centre, tc.name AS to_centre,
            fcl.name AS from_class, tcl.name AS to_class, r.left_reason, r.note,
            u.name AS by_name
       FROM student_reactivations r
       JOIN students s ON s.id = r.student_id
       LEFT JOIN centers fc ON fc.id = r.from_center_id
       JOIN centers tc ON tc.id = r.to_center_id
       LEFT JOIN class_levels fcl ON fcl.id = r.from_class_id
       JOIN class_levels tcl ON tcl.id = r.to_class_id
       LEFT JOIN users u ON u.id = r.reactivated_by
      WHERE r.reactivated_on BETWEEN $1 AND $2 ${where}
      ORDER BY r.reactivated_on DESC, r.id DESC`,
    params,
  );
  return {
    title: "Students brought back",
    subtitle: `${period} · ${rows.length} student${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "reactivated_on", label: "Date", width: 12 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment_no", label: "Enrolment No", width: 14 },
      { key: "was", label: "Was", width: 11 },
      { key: "from_centre", label: "From centre", width: 16 },
      { key: "to_centre", label: "To centre", width: 16 },
      { key: "from_class", label: "Class before", width: 12 },
      { key: "to_class", label: "Class now", width: 12 },
      { key: "left_reason", label: "Why they had left", width: 36 },
      { key: "note", label: "Note", width: 30 },
      { key: "by_name", label: "Brought back by", width: 18 },
    ],
    rows: rows.map((r) => ({
      reactivated_on: String(r.reactivated_on).slice(0, 10), student: r.student,
      enrollment_no: r.enrollment_no, was: r.from_status === "graduated" ? "Passed out" : "Suspended",
      from_centre: r.from_centre ?? "", to_centre: r.to_centre, from_class: r.from_class ?? "—",
      to_class: r.to_class, left_reason: r.left_reason ?? "", note: r.note ?? "",
      by_name: r.by_name ?? "",
    })),
  };
}

/* ------------------------------------------------------------------- PTM */

/**
 * Family by family, on every day parents were expected: who came, and who did
 * not. The list a teacher follows up from, so it carries the parents' names
 * and a number to ring rather than only a count.
 */
async function ptmAttendance(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  const centre = p.centerId ? ` AND center_id = $${params.push(p.centerId)}` : "";
  const cls = p.classId ? ` AND e.class_level_id = $${params.push(p.classId)}` : "";

  const rows = await query<{
    ptm_day: string; center_name: string; class_name: string | null; student: string;
    enrollment_no: string; came: boolean; parent_present: string | null;
    parent_name: string | null; phone: string | null; family_phone: string | null;
    engagement: string | null; concerns: string[] | null; follow_up: string | null;
    last_met: string | null; father_name: string | null; mother_name: string | null;
  }>(
    `WITH booked AS (
       SELECT m.meeting_date AS ptm_day, m.center_id, m.session_id, m.class_level_id
         FROM ptm_meetings m
        WHERE m.meeting_date BETWEEN $1 AND $2 AND m.status <> 'cancelled'${centre}
       UNION
       SELECT i.interaction_date, i.center_id, i.session_id, NULL::bigint
         FROM ptm_interactions i
        WHERE i.interaction_date BETWEEN $1 AND $2${centre}
          AND NOT EXISTS (SELECT 1 FROM ptm_meetings m2
                           WHERE m2.meeting_date = i.interaction_date
                             AND m2.center_id = i.center_id AND m2.status <> 'cancelled')
     ),
     expected AS (
       SELECT DISTINCT b.ptm_day, e.student_id, e.center_id, e.class_level_id
         FROM booked b
         JOIN enrollments e ON e.center_id = b.center_id AND e.session_id = b.session_id
                           AND e.status = 'active'
                           AND (b.class_level_id IS NULL OR e.class_level_id = b.class_level_id)${cls}
         JOIN students s ON s.id = e.student_id AND s.status = 'active'
     )
     SELECT to_char(x.ptm_day, 'YYYY-MM-DD') AS ptm_day, ce.name AS center_name,
            cl.name AS class_name,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS student,
            s.enrollment_no, (i.id IS NOT NULL) AS came,
            i.parent_present, i.engagement, i.concern_tags AS concerns,
            CASE WHEN i.follow_up_required
                 THEN to_char(i.follow_up_date, 'YYYY-MM-DD') END AS follow_up,
            NULLIF(s.father_name, '') AS father_name, NULLIF(s.mother_name, '') AS mother_name,
            ${PARENT_NAME}, ${PHONE.replace("AS phone", "AS phone")},
            ${FAMILY_PHONE.replace("AS phone", "AS family_phone")},
            to_char((SELECT max(j.interaction_date) FROM ptm_interactions j
                      WHERE j.student_id = s.id AND j.interaction_date < x.ptm_day),
                    'YYYY-MM-DD') AS last_met
       FROM expected x
       JOIN students s ON s.id = x.student_id
       JOIN centers ce ON ce.id = x.center_id
       LEFT JOIN class_levels cl ON cl.id = x.class_level_id
       LEFT JOIN ptm_interactions i ON i.student_id = x.student_id
                                   AND i.interaction_date = x.ptm_day
      ORDER BY x.ptm_day DESC, ce.code, cl.sequence NULLS LAST, s.first_name`,
    params,
  );

  const came = rows.filter((r) => r.came).length;
  return {
    title: "PTM attendance — who came and who did not",
    subtitle: `${period} · ${came} of ${rows.length} families seen`,
    columns: [
      { key: "ptm_day", label: "PTM day", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "class_name", label: "Class" },
      { key: "student", label: "Student", width: 22 },
      { key: "enrollment_no", label: "Enrolment no.", width: 14 },
      { key: "came", label: "Came?", width: 10 },
      { key: "parent_present", label: "Who came", width: 14 },
      { key: "parent_name", label: "Parent", width: 22 },
      { key: "phone", label: "Phone", width: 14 },
      { key: "engagement", label: "How it went", width: 14 },
      { key: "concerns", label: "Concerns raised", width: 32 },
      { key: "follow_up", label: "Follow-up due", width: 12 },
      { key: "last_met", label: "Last met before this", width: 14 },
    ],
    rows: rows.map((r) => ({
      ptm_day: r.ptm_day,
      center_name: r.center_name,
      class_name: r.class_name ?? "—",
      student: r.student,
      enrollment_no: r.enrollment_no,
      came: r.came ? "Came" : "Did not come",
      parent_present: r.came ? titleCase(r.parent_present ?? "") : "",
      parent_name: r.parent_name
        ?? [r.father_name, r.mother_name].filter(Boolean).join(" & "),
      phone: r.phone ?? r.family_phone ?? "",
      engagement: r.came ? titleCase(r.engagement ?? "") : "",
      concerns: (r.concerns ?? []).join("; "),
      follow_up: r.follow_up ?? "",
      last_met: r.last_met ?? "never",
    })),
  };
}


/**
 * A mentor's working day, in a sheet. The same reading as the day book on the
 * screen: what was entered on each day, and which meeting dates it covered.
 */
async function mentorDaily(p: ReportParams, period: string): Promise<ReportResult> {
  const rows = await mentorDays(p.from, p.to, p.centerId, null);
  const written = rows.reduce((n, r) => n + r.written_up, 0);
  return {
    title: "Mentor day book",
    subtitle: `${period} · ${written} meeting${written === 1 ? "" : "s"} written up `
      + `over ${new Set(rows.map((r) => r.day)).size} working days`,
    columns: [
      { key: "day", label: "Day of work", width: 13 },
      { key: "mentor", label: "Mentor", width: 22 },
      { key: "written_up", label: "Meetings written up", numeric: true, width: 18 },
      { key: "met_today", label: "Meetings held that day", numeric: true, width: 20 },
      { key: "meeting_dates", label: "Meeting dates covered", numeric: true, width: 19 },
      { key: "oldest_meeting", label: "Oldest meeting", width: 14 },
      { key: "children", label: "Children", numeric: true },
      { key: "centres", label: "Centres", width: 28 },
      { key: "follow_ups_promised", label: "Follow-ups promised", numeric: true, width: 18 },
      { key: "flags_raised", label: "Children referred", numeric: true, width: 16 },
      { key: "counselling_steps", label: "Counselling steps", numeric: true, width: 16 },
      { key: "feedback", label: "Centre feedback", numeric: true, width: 14 },
    ],
    rows: rows.map((r) => ({
      day: r.day, mentor: r.mentor, written_up: r.written_up, met_today: r.met_today,
      meeting_dates: r.meeting_dates, oldest_meeting: r.oldest_meeting ?? "",
      children: r.children, centres: r.centres ?? "",
      follow_ups_promised: r.follow_ups_promised, flags_raised: r.flags_raised,
      counselling_steps: r.counselling_steps, feedback: r.feedback,
    })),
  };
}

/** A sports teacher's working day, in a sheet. */
async function sportsDaily(p: ReportParams, period: string): Promise<ReportResult> {
  const rows = await sportsDays(p.from, p.to, p.centerId, null);
  const visits = rows.reduce((n, r) => n + r.visits, 0);
  return {
    title: "Sports day book",
    subtitle: `${period} · ${visits} centre visit${visits === 1 ? "" : "s"} `
      + `over ${new Set(rows.map((r) => r.day)).size} working days`,
    columns: [
      { key: "day", label: "Day of work", width: 13 },
      { key: "teacher", label: "Sports teacher", width: 22 },
      { key: "visits", label: "Centre visits", numeric: true, width: 13 },
      { key: "reports_filed", label: "Reports filed", numeric: true, width: 13 },
      { key: "centres", label: "Centres", width: 28 },
      { key: "children_seen", label: "Children seen", numeric: true, width: 14 },
      { key: "minutes", label: "Minutes at centres", numeric: true, width: 17 },
      { key: "sessions", label: "Sessions marked", numeric: true, width: 15 },
      { key: "attendance_marked", label: "Children marked", numeric: true, width: 15 },
      { key: "tests", label: "Tests set", numeric: true, width: 10 },
      { key: "marks", label: "Marks entered", numeric: true, width: 13 },
      { key: "remarks", label: "Remarks written", numeric: true, width: 15 },
    ],
    rows: rows.map((r) => ({
      day: r.day, teacher: r.teacher, visits: r.visits, reports_filed: r.reports_filed,
      centres: r.centres ?? "", children_seen: r.children_seen, minutes: r.minutes,
      sessions: r.sessions, attendance_marked: r.attendance_marked,
      tests: r.tests, marks: r.marks, remarks: r.remarks,
    })),
  };
}

/** An auditor's working day, in a sheet. */
async function auditorDaily(p: ReportParams, period: string): Promise<ReportResult> {
  const rows = await auditorDays(p.from, p.to, p.centerId, null);
  const visits = rows.reduce((n, r) => n + r.visits_filed, 0);
  return {
    title: "Auditor day book",
    subtitle: `${period} · ${visits} visit${visits === 1 ? "" : "s"} filed `
      + `over ${new Set(rows.map((r) => r.day)).size} working days`,
    columns: [
      { key: "day", label: "Day of work", width: 13 },
      { key: "auditor", label: "Auditor", width: 22 },
      { key: "visits_filed", label: "Visits filed", numeric: true, width: 12 },
      { key: "visits_made", label: "Visits made that day", numeric: true, width: 18 },
      { key: "centres", label: "Centres", width: 28 },
      { key: "children_seen", label: "Children counted", numeric: true, width: 16 },
      { key: "avg_score", label: "Average score %", numeric: true, width: 15 },
      { key: "suggestions", label: "Suggestions raised", numeric: true, width: 17 },
      { key: "replies", label: "Replies written", numeric: true, width: 14 },
      { key: "verified", label: "Claims verified", numeric: true, width: 14 },
      { key: "scheduled", label: "Visits booked", numeric: true, width: 13 },
    ],
    rows: rows.map((r) => ({
      day: r.day, auditor: r.auditor, visits_filed: r.visits_filed,
      visits_made: r.visits_made, centres: r.centres ?? "",
      children_seen: r.children_seen, avg_score: r.avg_score ?? "",
      suggestions: r.suggestions, replies: r.replies, verified: r.verified,
      scheduled: r.scheduled,
    })),
  };
}


/** A day at a centre, as the parent meetings left it. */
async function ptmDaily(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND i.center_id = $${params.length}`; }

  const rows = await query<{
    ptm_day: string; center_name: string; held: string; children: string; both: string;
    mother: string; father: string; guardian: string; attentive: string; neutral: string;
    resistant: string; follow_ups: string; support: string; concerns: string[] | null;
    days_later: string | null; written_on: string | null;
  }>(
    `SELECT to_char(i.interaction_date, 'YYYY-MM-DD') AS ptm_day, ce.name AS center_name,
            count(*) AS held, count(DISTINCT i.student_id) AS children,
            count(*) FILTER (WHERE i.parent_present = 'both')     AS both,
            count(*) FILTER (WHERE i.parent_present = 'mother')   AS mother,
            count(*) FILTER (WHERE i.parent_present = 'father')   AS father,
            count(*) FILTER (WHERE i.parent_present = 'guardian') AS guardian,
            count(*) FILTER (WHERE i.engagement = 'attentive')    AS attentive,
            count(*) FILTER (WHERE i.engagement = 'neutral')      AS neutral,
            count(*) FILTER (WHERE i.engagement = 'resistant')    AS resistant,
            count(*) FILTER (WHERE i.follow_up_required)          AS follow_ups,
            count(*) FILTER (WHERE i.support_needed IS NOT NULL)  AS support,
            round(avg((i.created_at AT TIME ZONE 'Asia/Kolkata')::date
                      - i.interaction_date), 1)                  AS days_later,
            to_char(max(i.created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS written_on,
            (SELECT array_agg(x.t || ' (' || x.n || ')' ORDER BY x.n DESC, x.t)
               FROM (SELECT t, count(*) AS n
                       FROM ptm_interactions j, unnest(j.concern_tags) t
                      WHERE j.center_id = i.center_id
                        AND j.interaction_date = i.interaction_date
                      GROUP BY t ORDER BY count(*) DESC, t LIMIT 3) x) AS concerns
       FROM ptm_interactions i
       JOIN centers ce ON ce.id = i.center_id
      WHERE i.interaction_date BETWEEN $1 AND $2 ${where}
      GROUP BY i.interaction_date, i.center_id, ce.code, ce.name
      ORDER BY i.interaction_date DESC, ce.code`,
    params,
  );

  const total = rows.reduce((n, r) => n + Number(r.held), 0);
  return {
    title: "PTM day by day, centre by centre",
    subtitle: `${period} · ${total} meeting${total === 1 ? "" : "s"} over ${rows.length} centre-day${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "day", label: "Meeting date", width: 13 },
      { key: "written_on", label: "Written up on", width: 14 },
      { key: "days_later", label: "Days later", numeric: true, width: 11 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "held", label: "Meetings", numeric: true },
      { key: "children", label: "Children", numeric: true },
      { key: "both", label: "Both parents", numeric: true, width: 12 },
      { key: "mother", label: "Mother", numeric: true },
      { key: "father", label: "Father", numeric: true },
      { key: "guardian", label: "Guardian", numeric: true },
      { key: "attentive", label: "Attentive", numeric: true },
      { key: "neutral", label: "Neutral", numeric: true },
      { key: "resistant", label: "Resistant", numeric: true },
      { key: "follow_ups", label: "Follow-ups", numeric: true },
      { key: "support", label: "Asked for help", numeric: true, width: 13 },
      { key: "concerns", label: "Concerns raised most", width: 46 },
    ],
    rows: rows.map((r) => ({
      day: r.ptm_day,
      written_on: r.written_on ?? "",
      days_later: r.days_later == null ? "" : Number(r.days_later),
      center_name: r.center_name, held: Number(r.held),
      children: Number(r.children), both: Number(r.both), mother: Number(r.mother),
      father: Number(r.father), guardian: Number(r.guardian), attentive: Number(r.attentive),
      neutral: Number(r.neutral), resistant: Number(r.resistant),
      follow_ups: Number(r.follow_ups), support: Number(r.support),
      concerns: (r.concerns ?? []).join(", "),
    })),
  };
}

/** Concerns and commitments, counted per centre. */
async function ptmConcernsReport(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND i.center_id = $${params.length}`; }

  const rows = await query<{
    kind: string; tag: string; center_name: string; n: string; children: string;
    first_seen: string; last_seen: string;
  }>(
    `SELECT kind, tag, center_name, count(*) AS n, count(DISTINCT student_id) AS children,
            to_char(min(interaction_date), 'YYYY-MM-DD') AS first_seen,
            to_char(max(interaction_date), 'YYYY-MM-DD') AS last_seen
       FROM (
         SELECT 'Concern' AS kind, t AS tag, ce.name AS center_name, i.student_id, i.interaction_date
           FROM ptm_interactions i JOIN centers ce ON ce.id = i.center_id,
                unnest(i.concern_tags) t
          WHERE i.interaction_date BETWEEN $1 AND $2 ${where}
         UNION ALL
         SELECT 'Commitment', t, ce.name, i.student_id, i.interaction_date
           FROM ptm_interactions i JOIN centers ce ON ce.id = i.center_id,
                unnest(i.commitment_tags) t
          WHERE i.interaction_date BETWEEN $1 AND $2 ${where}
       ) x
      GROUP BY kind, tag, center_name
      ORDER BY kind, count(*) DESC, tag, center_name`,
    params,
  );

  return {
    title: "What parents raise",
    subtitle: `${period} · concerns ticked and commitments made, by centre`,
    columns: [
      { key: "kind", label: "Kind", width: 12 },
      { key: "tag", label: "What", width: 30 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "n", label: "Times", numeric: true },
      { key: "children", label: "Children", numeric: true },
      { key: "first_seen", label: "First", width: 12 },
      { key: "last_seen", label: "Last", width: 12 },
    ],
    rows: rows.map((r) => ({
      kind: r.kind, tag: r.tag, center_name: r.center_name, n: Number(r.n),
      children: Number(r.children), first_seen: r.first_seen, last_seen: r.last_seen,
    })),
  };
}

/* --------------------------------------------------------------- audits */

const OVERALL_WORDS: Record<string, string> = {
  healthy: "Healthy", attention: "Needs attention",
  support: "Support required", urgent: "Immediate intervention",
};

async function auditVisitsReport(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND v.center_id = $${params.length}`; }

  const rows = await query<{
    visited_on: string; center_name: string; auditor: string | null; kind: string;
    status: string; overall: string | null; score_pct: string | null;
    children_present: number | null; children_on_roll: number | null;
    staff_present: number | null; staff_on_roll: number | null; summary: string | null;
    checks: number; weak: number; suggestions: number;
  }>(
    `SELECT to_char(COALESCE(v.visited_on, v.scheduled_for), 'YYYY-MM-DD') AS visited_on,
            c.name AS center_name, u.name AS auditor, v.kind, v.status, v.overall, v.score_pct,
            v.children_present, v.children_on_roll, v.staff_present, v.staff_on_roll, v.summary,
            (SELECT count(*) FROM audit_ratings r
              WHERE r.visit_id = v.id AND r.band > 0)::int                       AS checks,
            (SELECT count(*) FROM audit_ratings r
              WHERE r.visit_id = v.id AND r.band BETWEEN 1 AND 2)::int           AS weak,
            (SELECT count(*) FROM audit_suggestions s WHERE s.visit_id = v.id)::int AS suggestions
       FROM audit_visits v
       JOIN centers c ON c.id = v.center_id
       LEFT JOIN users u ON u.id = v.auditor_id
      WHERE COALESCE(v.visited_on, v.scheduled_for) BETWEEN $1 AND $2 ${where}
      ORDER BY COALESCE(v.visited_on, v.scheduled_for) DESC, c.code`,
    params,
  );

  return {
    title: "Centre audit visits",
    subtitle: `${period} · ${rows.length} visit${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "visited_on", label: "Date", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "auditor", label: "Auditor", width: 18 },
      { key: "kind", label: "Kind of visit", width: 14 },
      { key: "status", label: "Status", width: 12 },
      { key: "overall", label: "How the centre was found", width: 22 },
      { key: "score_pct", label: "Score %", numeric: true },
      { key: "children", label: "Children present", width: 15 },
      { key: "staff", label: "Staff present", width: 13 },
      { key: "checks", label: "Points checked", numeric: true, width: 13 },
      { key: "weak", label: "Weak or poor", numeric: true, width: 12 },
      { key: "suggestions", label: "Suggestions", numeric: true },
      { key: "summary", label: "What the auditor wrote", width: 44 },
    ],
    rows: rows.map((r) => ({
      visited_on: r.visited_on, center_name: r.center_name, auditor: r.auditor ?? "",
      kind: titleCase(r.kind.replace(/_/g, " ")), status: titleCase(r.status.replace(/_/g, " ")),
      overall: r.overall ? OVERALL_WORDS[r.overall] ?? r.overall : "",
      score_pct: r.score_pct == null ? null : Number(r.score_pct),
      children: r.children_present == null ? "" : `${r.children_present} of ${r.children_on_roll ?? "—"}`,
      staff: r.staff_present == null ? "" : `${r.staff_present} of ${r.staff_on_roll ?? "—"}`,
      checks: r.checks, weak: r.weak, suggestions: r.suggestions, summary: r.summary ?? "",
    })),
  };
}

async function auditSuggestionsReport(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND s.center_id = $${params.length}`; }

  const rows = await query<{
    raised_on: string; center_name: string; auditor: string | null; title: string;
    detail: string | null; criterion: string | null; priority: string; status: string;
    due_on: string | null; days_late: number | null; verdict: string | null;
    replies: number; last_reply: string | null;
  }>(
    `SELECT to_char(s.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS raised_on,
            c.name AS center_name, u.name AS auditor, s.title, s.detail,
            cr.title AS criterion, s.priority, s.status,
            to_char(s.due_on, 'YYYY-MM-DD') AS due_on,
            CASE WHEN s.due_on IS NOT NULL AND s.status IN ('open','in_progress','done')
                   AND s.due_on < CURRENT_DATE THEN (CURRENT_DATE - s.due_on)::int END AS days_late,
            s.verdict,
            (SELECT count(*) FROM audit_replies r WHERE r.suggestion_id = s.id)::int AS replies,
            (SELECT r.body FROM audit_replies r WHERE r.suggestion_id = s.id
              ORDER BY r.created_at DESC LIMIT 1) AS last_reply
       FROM audit_suggestions s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN users u ON u.id = s.raised_by
       LEFT JOIN audit_criteria cr ON cr.id = s.criterion_id
      WHERE s.created_at::date BETWEEN $1 AND $2 ${where}
      ORDER BY s.created_at DESC`,
    params,
  );

  return {
    title: "Audit suggestions",
    subtitle: `${period} · ${rows.length} suggestion${rows.length === 1 ? "" : "s"}`,
    columns: [
      { key: "raised_on", label: "Raised", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "auditor", label: "Raised by", width: 18 },
      { key: "title", label: "What needs doing", width: 36 },
      { key: "criterion", label: "Against which check", width: 20 },
      { key: "priority", label: "Priority", width: 10 },
      { key: "due_on", label: "Due", width: 12 },
      { key: "status", label: "Where it stands", width: 18 },
      { key: "days_late", label: "Days late", numeric: true },
      { key: "verdict", label: "Auditor's verdict", width: 16 },
      { key: "replies", label: "Replies", numeric: true },
      { key: "last_reply", label: "What the centre said", width: 40 },
      { key: "detail", label: "Detail", width: 36 },
    ],
    rows: rows.map((r) => ({
      raised_on: r.raised_on, center_name: r.center_name, auditor: r.auditor ?? "",
      title: r.title, criterion: r.criterion ?? "", priority: titleCase(r.priority),
      due_on: r.due_on ?? "", status: titleCase(r.status.replace(/_/g, " ")),
      days_late: r.days_late, verdict: r.verdict ? titleCase(r.verdict.replace(/_/g, " ")) : "",
      replies: r.replies, last_reply: r.last_reply ?? "", detail: r.detail ?? "",
    })),
  };
}

async function auditRatingsReport(p: ReportParams, period: string): Promise<ReportResult> {
  const params: unknown[] = [p.from, p.to];
  let where = "";
  if (p.centerId) { params.push(p.centerId); where += ` AND v.center_id = $${params.length}`; }

  const rows = await query<{
    visited_on: string; center_name: string; auditor: string | null; section: string;
    criterion_title: string; band: number; weight: number; reason: string | null;
    note: string | null;
  }>(
    `SELECT to_char(v.visited_on, 'YYYY-MM-DD') AS visited_on, c.name AS center_name,
            u.name AS auditor, r.section, r.criterion_title, r.band, r.weight, r.reason, r.note
       FROM audit_ratings r
       JOIN audit_visits v ON v.id = r.visit_id
       JOIN centers c ON c.id = v.center_id
       LEFT JOIN users u ON u.id = v.auditor_id
      WHERE v.status = 'submitted' AND v.visited_on BETWEEN $1 AND $2 ${where}
      ORDER BY v.visited_on DESC, c.code, r.section, r.criterion_title`,
    params,
  );

  const BAND: Record<number, string> = {
    4: "Good", 3: "Fair", 2: "Weak", 1: "Poor", 0: "Not applicable",
  };
  return {
    title: "Audit checklist scores",
    subtitle: `${period} · ${rows.length} point${rows.length === 1 ? "" : "s"} scored`,
    columns: [
      { key: "visited_on", label: "Date", width: 12 },
      { key: "center_name", label: "Centre", width: 16 },
      { key: "auditor", label: "Auditor", width: 18 },
      { key: "section", label: "Section", width: 14 },
      { key: "criterion_title", label: "Check", width: 24 },
      { key: "band_label", label: "How it was found", width: 16 },
      { key: "band", label: "Band", numeric: true },
      { key: "weight", label: "Weight", numeric: true },
      { key: "reason", label: "Reason given", width: 30 },
      { key: "note", label: "Note", width: 36 },
    ],
    rows: rows.map((r) => ({
      visited_on: r.visited_on, center_name: r.center_name, auditor: r.auditor ?? "",
      section: r.section, criterion_title: r.criterion_title,
      band_label: BAND[r.band] ?? String(r.band), band: r.band, weight: r.weight,
      reason: r.reason ?? "", note: r.note ?? "",
    })),
  };
}
