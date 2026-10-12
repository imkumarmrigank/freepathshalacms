import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { PageHeader, Card, Empty } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";

const STUDENT_STATUSES = ["active", "inactive", "dropped", "transferred", "graduated", "suspended"];
const STAFF_ROLES = [
  "super_admin", "admin", "center_manager", "teacher", "backup_teacher",
  "mentor", "admin_backup", "rider", "hq_manager",
];

export default async function DataExplorerPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole("super_admin");
  const sp = await searchParams;

  const tab = sp.tab === "staff" ? "staff" : "students";

  const [centers, classes, sessions] = await Promise.all([
    query<{ id: number; name: string; code: string }>(
      "SELECT id, name, code FROM centers WHERE is_active ORDER BY code"),
    query<{ id: number; name: string }>(
      "SELECT id, name FROM class_levels ORDER BY sequence"),
    query<{ id: number; name: string; is_current: boolean }>(
      "SELECT id, name, is_current FROM academic_sessions ORDER BY sequence DESC"),
  ]);

  const centerId = sp.center ? Number(sp.center) : null;
  const classId  = sp.class  ? Number(sp.class)  : null;
  const sessionId = sp.session ? Number(sp.session) : (sessions.find((s) => s.is_current)?.id ?? null);

  // ── Students ──────────────────────────────────────────────────────────────
  let studentRows: Record<string, string | null>[] = [];
  let studentTotal = 0;
  const studentPg = pageFrom(sp, 50);

  if (tab === "students") {
    const params: unknown[] = [];
    const conds: string[] = [];

    if (sessionId) { params.push(sessionId); conds.push(`e.session_id = $${params.length}`); }
    if (centerId)  { params.push(centerId);  conds.push(`s.center_id = $${params.length}`); }
    if (classId)   { params.push(classId);   conds.push(`e.class_level_id = $${params.length}`); }
    if (sp.status) { params.push(sp.status); conds.push(`s.status = $${params.length}`); }
    if (sp.gender) { params.push(sp.gender); conds.push(`s.gender = $${params.length}`); }
    if (sp.q)      { params.push(`%${sp.q}%`);
                     conds.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.enrollment_no ILIKE $${params.length} OR s.primary_phone ILIKE $${params.length})`); }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "WHERE TRUE";

    params.push(studentPg.size, studentPg.offset);
    const rows = await query<Record<string, string | null>>(
      `SELECT count(*) OVER () AS total_rows,
              s.enrollment_no, trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
              cl.name AS class_name, e.section, e.roll_no::text AS roll_no,
              ce.name AS center_name, ce.code AS center_code,
              s.gender, s.dob::text AS dob,
              CASE WHEN s.dob IS NOT NULL THEN date_part('year', age(s.dob))::int::text END AS age,
              s.father_name, s.mother_name, s.primary_phone, s.alt_phone,
              s.whatsapp_number, s.address, s.city, s.state, s.pincode,
              s.religion, s.category, s.blood_group, s.aadhaar_number,
              s.admission_date::text AS admission_date, e.source, s.status
         FROM students s
         LEFT JOIN enrollments e ON e.student_id = s.id
           ${sessionId ? "AND e.session_id = $1" : "AND e.id = (SELECT id FROM enrollments WHERE student_id = s.id ORDER BY id DESC LIMIT 1)"}
         LEFT JOIN class_levels cl ON cl.id = e.class_level_id
         JOIN centers ce ON ce.id = s.center_id
         ${where}
         ORDER BY ce.code, cl.sequence NULLS LAST, student
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    studentTotal = totalOf(rows);
    studentRows = rows;
  }

  const studentWin = pageWindow(studentPg, studentRows.length, studentTotal);

  // ── Staff ─────────────────────────────────────────────────────────────────
  let staffRows: Record<string, string | null>[] = [];
  let staffTotal = 0;
  const staffPg = pageFrom(sp, 50);

  if (tab === "staff") {
    const params: unknown[] = ["false"]; // is_test = false
    const conds: string[] = ["u.is_test = $1"];

    if (centerId)    { params.push(centerId);    conds.push(`u.center_id = $${params.length}`); }
    if (sp.role)     { params.push(sp.role);     conds.push(`u.role = $${params.length}`); }
    if (sp.active === "1") { conds.push("u.is_active"); }
    if (sp.active === "0") { conds.push("NOT u.is_active"); }
    if (sp.q)        { params.push(`%${sp.q}%`);
                       conds.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length})`); }

    const where = `WHERE ${conds.join(" AND ")}`;
    params.push(staffPg.size, staffPg.offset);

    const rows = await query<Record<string, string | null>>(
      `SELECT count(*) OVER () AS total_rows,
              u.name, u.email, u.phone, u.role, u.designation,
              u.is_active::text AS is_active,
              ce.name AS center_name, ce.code AS center_code,
              u.last_login_at::text AS last_login_at,
              u.created_at::text AS created_at
         FROM users u
         LEFT JOIN centers ce ON ce.id = u.center_id
         ${where}
         ORDER BY ce.code NULLS LAST, u.role, u.name
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    staffTotal = totalOf(rows);
    staffRows = rows;
  }

  const staffWin = pageWindow(staffPg, staffRows.length, staffTotal);

  // build export URL (mirrors current filters)
  const exportParams = new URLSearchParams({ tab });
  if (centerId)  exportParams.set("center",  String(centerId));
  if (classId)   exportParams.set("class",   String(classId));
  if (sessionId) exportParams.set("session", String(sessionId));
  if (sp.status) exportParams.set("status",  sp.status);
  if (sp.gender) exportParams.set("gender",  sp.gender);
  if (sp.role)   exportParams.set("role",    sp.role);
  if (sp.active) exportParams.set("active",  sp.active);
  if (sp.q)      exportParams.set("q",       sp.q);

  return (
    <>
      <PageHeader title="Data explorer"
        subtitle="Full dataset for every student and staff member — filter, then export to CSV" />

      {/* Tab switcher */}
      <div className="mb-4 flex gap-1 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-1 w-fit">
        {(["students", "staff"] as const).map((t) => (
          <Link key={t} href={`/data?tab=${t}`}
            className={`rounded-[8px] px-4 py-1.5 text-[13px] font-medium capitalize transition-colors
              ${tab === t
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-[var(--muted)] hover:text-[var(--text)]"}`}>
            {t}
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Filters
          centers={centers}
          classes={tab === "students" ? classes : []}
          sessions={tab === "students" ? sessions : []}
          searchPlaceholder={tab === "students" ? "Name, enrolment no, phone…" : "Name, email, phone…"}
          current={sp}
          extra={[
            ...(tab === "students" ? [
              { name: "status", label: "All statuses",
                options: STUDENT_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })) },
              { name: "gender", label: "All genders",
                options: [{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }] },
            ] : [
              { name: "role", label: "All roles",
                options: STAFF_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })) },
              { name: "active", label: "All",
                options: [{ value: "1", label: "Active only" }, { value: "0", label: "Inactive only" }] },
            ]),
          ]}
        />
        <Link href={`/api/data/export?${exportParams}`}
          className="btn btn-ghost ml-auto whitespace-nowrap" prefetch={false}>
          ↓ Export CSV
        </Link>
      </div>

      {/* Students table */}
      {tab === "students" && (
        <Card pad={false}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <span className="text-[13px] text-[var(--muted)]">
              {studentTotal} student{studentTotal === 1 ? "" : "s"}
            </span>
          </div>
          {studentRows.length === 0 ? (
            <Empty title="No students" hint="Adjust the filters above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl text-[12px]">
                <thead>
                  <tr>
                    <th>Enrolment No</th><th>Student</th><th>Class</th><th>Section</th>
                    <th>Roll</th><th>Centre</th><th>Gender</th><th>DOB</th><th>Age</th>
                    <th>Father</th><th>Mother</th><th>Phone</th><th>Alt Phone</th>
                    <th>WhatsApp</th><th>Address</th><th>City</th><th>State</th>
                    <th>Pincode</th><th>Religion</th><th>Category</th><th>Blood</th>
                    <th>Aadhaar</th><th>Admitted</th><th>Source</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((r, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap font-mono text-[11px]">{r.enrollment_no}</td>
                      <td className="whitespace-nowrap font-medium">{r.student}</td>
                      <td className="whitespace-nowrap">{r.class_name}</td>
                      <td>{r.section}</td>
                      <td className="text-right tabular-nums">{r.roll_no}</td>
                      <td className="whitespace-nowrap">{r.center_code} · {r.center_name}</td>
                      <td className="capitalize">{r.gender}</td>
                      <td className="whitespace-nowrap">{r.dob ? fmtDate(r.dob) : "—"}</td>
                      <td className="text-right tabular-nums">{r.age ?? "—"}</td>
                      <td>{r.father_name}</td>
                      <td>{r.mother_name}</td>
                      <td className="whitespace-nowrap">{r.primary_phone}</td>
                      <td className="whitespace-nowrap">{r.alt_phone}</td>
                      <td className="whitespace-nowrap">{r.whatsapp_number}</td>
                      <td>{r.address}</td>
                      <td>{r.city}</td>
                      <td>{r.state}</td>
                      <td>{r.pincode}</td>
                      <td>{r.religion}</td>
                      <td>{r.category}</td>
                      <td>{r.blood_group}</td>
                      <td className="font-mono text-[11px]">{r.aadhaar_number}</td>
                      <td className="whitespace-nowrap">{r.admission_date ? fmtDate(r.admission_date) : "—"}</td>
                      <td className="capitalize">{r.source}</td>
                      <td className="capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={studentPg.page} pages={studentWin.pages}
            first={studentWin.first} last={studentWin.last}
            total={studentTotal} unit="student" />
        </Card>
      )}

      {/* Staff table */}
      {tab === "staff" && (
        <Card pad={false}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
            <span className="text-[13px] text-[var(--muted)]">
              {staffTotal} staff member{staffTotal === 1 ? "" : "s"}
            </span>
          </div>
          {staffRows.length === 0 ? (
            <Empty title="No staff" hint="Adjust the filters above." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl text-[12px]">
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Phone</th><th>Role</th>
                    <th>Designation</th><th>Centre</th><th>Active</th>
                    <th>Last login</th><th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((r, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap font-medium">{r.name}</td>
                      <td>{r.email}</td>
                      <td className="whitespace-nowrap">{r.phone}</td>
                      <td className="whitespace-nowrap capitalize">{r.role?.replace(/_/g, " ")}</td>
                      <td>{r.designation}</td>
                      <td className="whitespace-nowrap">{r.center_code ? `${r.center_code} · ${r.center_name}` : r.center_name}</td>
                      <td>{r.is_active === "true" ? "Yes" : "No"}</td>
                      <td className="whitespace-nowrap">{r.last_login_at ? fmtDate(r.last_login_at) : "Never"}</td>
                      <td className="whitespace-nowrap">{r.created_at ? fmtDate(r.created_at) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={staffPg.page} pages={staffWin.pages}
            first={staffWin.first} last={staffWin.last}
            total={staffTotal} unit="staff member" />
        </Card>
      )}
    </>
  );
}
