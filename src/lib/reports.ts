import "server-only";
import { query } from "./db";
import { reportByKey } from "./report-meta";
import { titleCase } from "./format";
import type { SessionUser } from "./auth";
import { isGlobalRole } from "./roles";

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
};

const COUNTED = "('present','late','half_day')";   // counts towards attendance
const MARKED = "status <> 'holiday'";              // days that count in the denominator

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

/** Every date in [from, to], capped so a huge range cannot blow up the register. */
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
    case "student-attendance-summary":   return studentAttendanceSummary(scoped, period);
    case "student-attendance-register":  return studentAttendanceRegister(scoped, period);
    case "staff-attendance-summary":     return staffAttendanceSummary(scoped, period);
    case "staff-attendance-detail":      return staffAttendanceDetail(scoped, period);
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
    case "teaching-plan-progress":       return teachingPlanProgress(scoped);
    case "timetable":                    return timetableReport(scoped);
    default: throw new Error("Unknown report.");
  }
}

/* ------------------------------------------------------------- attendance */

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
      WHERE u.is_active AND u.role IN ('teacher','center_manager') ${where}
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
  }>(
    `SELECT a.att_date, u.name, u.role, c.name AS center_name,
            to_char(a.check_in_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM')  AS check_in,
            to_char(a.check_out_at AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS check_out,
            a.worked_minutes, a.status, a.check_in_distance_m, a.within_geofence,
            o.name AS override_by_name, a.override_reason
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
      status: r.status, entry: r.override_by_name ? `Manual · ${r.override_by_name}` : "Geofenced",
      override_reason: r.override_reason,
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
            asg.name AS assigned_to
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
      { key: "interaction_date", label: "Date", width: 13 },
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
