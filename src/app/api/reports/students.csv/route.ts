import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { resolveCenterId } from "@/lib/queries";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const sessionId = Number(url.searchParams.get("session"));
  const centerId = resolveCenterId(user, url.searchParams.get("center"));
  if (!sessionId) return new NextResponse("session is required", { status: 400 });

  const rows = await query<Record<string, unknown>>(
    `SELECT s.enrollment_no AS "Enrolment No", s.first_name AS "First Name",
            s.last_name AS "Last Name", cl.name AS "Class", e.section AS "Section",
            e.roll_no AS "Roll No", ce.name AS "Centre", s.gender AS "Gender",
            s.dob AS "Date of Birth", s.father_name AS "Father", s.mother_name AS "Mother",
            s.primary_phone AS "Phone", s.admission_date AS "Admitted On",
            e.source AS "Enrolment Type", s.status AS "Status",
            (SELECT round(100.0 * count(*) FILTER (WHERE a.status IN ('present','late','half_day'))
                    / NULLIF(count(*) FILTER (WHERE a.status <> 'holiday'), 0), 1)
               FROM student_attendance a WHERE a.enrollment_id = e.id) AS "Attendance %"
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
      WHERE e.session_id = $1 ${centerId ? "AND e.center_id = $2" : ""}
      ORDER BY ce.code, cl.sequence, s.first_name`,
    centerId ? [sessionId, centerId] : [sessionId],
  );

  if (rows.length === 0) return new NextResponse("No data", { status: 404 });

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-session-${sessionId}.csv"`,
    },
  });
}
