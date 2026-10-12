import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { currentSession } from "@/lib/queries";

export const dynamic = "force-dynamic";

function csv(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: unknown[]) {
  return cells.map(csv).join(",");
}

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.role !== "super_admin") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") === "staff" ? "staff" : "students";
  const centerId  = Number(url.searchParams.get("center"))  || null;
  const classId   = Number(url.searchParams.get("class"))   || null;
  const statusFlt = url.searchParams.get("status") || null;
  const genderFlt = url.searchParams.get("gender") || null;
  const roleFlt   = url.searchParams.get("role")   || null;
  const activeFlt = url.searchParams.get("active") || null;
  const q         = url.searchParams.get("q")      || null;

  const session = await currentSession();
  const sessionId = Number(url.searchParams.get("session")) || session?.id || null;

  let lines: string[];

  if (tab === "students") {
    const params: unknown[] = [];
    const conds: string[] = [];

    if (sessionId) { params.push(sessionId); conds.push(`e.session_id = $${params.length}`); }
    if (centerId)  { params.push(centerId);  conds.push(`s.center_id = $${params.length}`); }
    if (classId)   { params.push(classId);   conds.push(`e.class_level_id = $${params.length}`); }
    if (statusFlt) { params.push(statusFlt); conds.push(`s.status = $${params.length}`); }
    if (genderFlt) { params.push(genderFlt); conds.push(`s.gender = $${params.length}`); }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.enrollment_no ILIKE $${params.length} OR s.primary_phone ILIKE $${params.length})`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "WHERE TRUE";

    const rows = await query<Record<string, string | null>>(
      `SELECT s.enrollment_no,
              trim(s.first_name || ' ' || COALESCE(s.last_name,'')) AS student,
              cl.name AS class_name, e.section, e.roll_no::text AS roll_no,
              ce.code AS center_code, ce.name AS center_name,
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
         ORDER BY ce.code, cl.sequence NULLS LAST, student`,
      params,
    );

    const header = row([
      "Enrolment No", "Student", "Class", "Section", "Roll No",
      "Centre Code", "Centre", "Gender", "DOB", "Age",
      "Father", "Mother", "Phone", "Alt Phone", "WhatsApp",
      "Address", "City", "State", "Pincode", "Religion",
      "Category", "Blood Group", "Aadhaar", "Admitted", "Source", "Status",
    ]);
    lines = [header, ...rows.map((r) => row([
      r.enrollment_no, r.student, r.class_name, r.section, r.roll_no,
      r.center_code, r.center_name, r.gender, r.dob, r.age,
      r.father_name, r.mother_name, r.primary_phone, r.alt_phone, r.whatsapp_number,
      r.address, r.city, r.state, r.pincode, r.religion,
      r.category, r.blood_group, r.aadhaar_number, r.admission_date, r.source, r.status,
    ]))];
  } else {
    // staff
    const params: unknown[] = ["false"];
    const conds: string[] = ["u.is_test = $1"];

    if (centerId)          { params.push(centerId);    conds.push(`u.center_id = $${params.length}`); }
    if (roleFlt)           { params.push(roleFlt);     conds.push(`u.role = $${params.length}`); }
    if (activeFlt === "1") { conds.push("u.is_active"); }
    if (activeFlt === "0") { conds.push("NOT u.is_active"); }
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
    }

    const where = `WHERE ${conds.join(" AND ")}`;

    const rows = await query<Record<string, string | null>>(
      `SELECT u.name, u.email, u.phone, u.role, u.designation,
              u.is_active::text AS is_active,
              ce.code AS center_code, ce.name AS center_name,
              u.last_login_at::text AS last_login_at,
              u.created_at::text AS created_at
         FROM users u
         LEFT JOIN centers ce ON ce.id = u.center_id
         ${where}
         ORDER BY ce.code NULLS LAST, u.role, u.name`,
      params,
    );

    const header = row([
      "Name", "Email", "Phone", "Role", "Designation",
      "Centre Code", "Centre", "Active", "Last Login", "Created",
    ]);
    lines = [header, ...rows.map((r) => row([
      r.name, r.email, r.phone, r.role?.replace(/_/g, " "), r.designation,
      r.center_code, r.center_name, r.is_active === "true" ? "Yes" : "No",
      r.last_login_at, r.created_at,
    ]))];
  }

  const filename = `${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
