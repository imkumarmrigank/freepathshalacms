import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession, listSessions } from "@/lib/queries";
import { Alert } from "@/components/ui";
import { fmtDate, fullName } from "@/lib/format";
import { EXAM_TYPE_LABEL, grade, percentage } from "@/lib/exam-meta";
import PrintButton from "./PrintButton";

export const metadata = { title: "Progress report · FreePathshala" };

export default async function ReportCardPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { session: sessionParam } = await searchParams;
  const studentId = Number(id);

  const [sessions, cur] = await Promise.all([listSessions(), currentSession()]);
  const sessionId = Number(sessionParam) || cur?.id || sessions[0]?.id;

  const student = await one<{
    id: number; enrollment_no: string; first_name: string; last_name: string | null;
    dob: string | null; gender: string | null; father_name: string | null;
    mother_name: string | null; guardian_name: string | null; primary_phone: string | null;
    admission_date: string; center_id: number;
    center_name: string; center_code: string; center_address: string | null;
    center_area: string | null; center_city: string | null; center_state: string | null;
    center_pincode: string | null; center_phone: string | null;
  }>(
    `SELECT s.id, s.enrollment_no, s.first_name, s.last_name, s.dob, s.gender,
            s.father_name, s.mother_name, s.guardian_name, s.primary_phone,
            s.admission_date, s.center_id,
            c.name AS center_name, c.code AS center_code, c.address AS center_address,
            c.area AS center_area, c.city AS center_city, c.state AS center_state,
            c.pincode AS center_pincode, c.phone AS center_phone
       FROM students s JOIN centers c ON c.id = s.center_id
      WHERE s.id = $1`,
    [studentId],
  );
  if (!student) notFound();
  if (user.role !== "super_admin" && student.center_id !== user.centerId)
    return <Alert kind="bad">This student belongs to another centre.</Alert>;

  const enrollment = await one<{
    class_name: string; section: string | null; roll_no: number | null; session_name: string;
    session_start: string; session_end: string;
  }>(
    `SELECT cl.name AS class_name, e.section, e.roll_no, a.name AS session_name,
            a.start_date AS session_start, a.end_date AS session_end
       FROM enrollments e
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN academic_sessions a ON a.id = e.session_id
      WHERE e.student_id = $1 AND e.session_id = $2`,
    [studentId, sessionId],
  );

  // Every paper set for this student's class — a test covers all subjects, so the
  // report groups them back together under the test they belong to.
  const marks = await query<{
    title: string; subject: string; exam_type: string; exam_date: string;
    term_label: string | null; max_marks: string; pass_marks: string | null;
    marks_obtained: string | null; is_absent: boolean;
  }>(
    `SELECT x.title, x.subject, x.exam_type, x.exam_date, x.term_label,
            x.max_marks, x.pass_marks,
            m.marks_obtained, COALESCE(m.is_absent, FALSE) AS is_absent
       FROM exams x
       LEFT JOIN exam_marks m ON m.exam_id = x.id AND m.student_id = $1
      WHERE x.session_id = $2 AND x.center_id = $3
        AND x.class_level_id = (SELECT class_level_id FROM enrollments
                                 WHERE student_id = $1 AND session_id = $2)
      ORDER BY x.exam_date, x.subject`,
    [studentId, sessionId, student.center_id],
  );

  const attendance = await one<{ present: string; marked: string }>(
    `SELECT count(*) FILTER (WHERE status IN ('present','late','half_day')) AS present,
            count(*) FILTER (WHERE status <> 'holiday') AS marked
       FROM student_attendance WHERE student_id = $1 AND session_id = $2`,
    [studentId, sessionId],
  );

  type Paper = {
    subject: string; max: number; obtained: number | null; isAbsent: boolean;
    pass: number | null;
  };
  type Test = {
    key: string; title: string; type: string; date: string;
    papers: Paper[]; obtained: number; max: number; graded: number;
  };

  // One block per test: same type + term label = the same test across subjects.
  const tests = new Map<string, Test>();
  for (const m of marks) {
    const key = `${m.exam_type}||${(m.term_label ?? m.title).toLowerCase()}`;
    let t = tests.get(key);
    if (!t) {
      t = { key, title: m.term_label ?? m.title, type: m.exam_type, date: m.exam_date,
            papers: [], obtained: 0, max: 0, graded: 0 };
      tests.set(key, t);
    }
    const obtained = m.is_absent || m.marks_obtained === null ? null : Number(m.marks_obtained);
    t.papers.push({
      subject: m.subject, max: Number(m.max_marks), obtained,
      isAbsent: m.is_absent, pass: m.pass_marks === null ? null : Number(m.pass_marks),
    });
    // only graded papers count towards a total, so a pending subject cannot drag it down
    if (obtained !== null) { t.obtained += obtained; t.max += Number(m.max_marks); t.graded += 1; }
    if (m.exam_date < t.date) t.date = m.exam_date;
  }
  const testList = [...tests.values()].sort((a, b) => a.date.localeCompare(b.date));

  const totalObtained = testList.reduce((n, t) => n + t.obtained, 0);
  const totalMax = testList.reduce((n, t) => n + t.max, 0);
  const overallPct = totalMax > 0 ? percentage(totalObtained, totalMax) : null;
  const anyGraded = testList.some((t) => t.graded > 0);

  const attPct = attendance && Number(attendance.marked) > 0
    ? Math.round((Number(attendance.present) / Number(attendance.marked)) * 1000) / 10
    : null;

  const centreLines = [
    student.center_address,
    [student.center_area, student.center_city].filter(Boolean).join(", "),
    [student.center_state, student.center_pincode].filter(Boolean).join(" "),
  ].filter((l) => l && l.trim() !== "");

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/students/${student.id}`}
          className="text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          ← Back to {fullName(student)}
        </Link>
        <div className="flex items-center gap-2">
          {sessions.length > 1 && (
            <form className="flex items-center gap-2">
              <select className="select w-auto" name="session" defaultValue={String(sessionId)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
                ))}
              </select>
              <button className="btn btn-ghost btn-sm" type="submit">Show</button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="sheet card card-pad bg-white" style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* ---------------------------------------------------------- letterhead */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-[var(--brand)] pb-4">
          <div className="flex items-start gap-4">
            <Image src="/logo.png" alt="FreePathshala" width={500} height={153}
              className="h-auto w-[150px]" priority />
          </div>
          <div className="text-right text-[12px] leading-relaxed text-[var(--muted)]">
            <div className="text-[15px] font-semibold text-[var(--text)]">
              {student.center_name}
            </div>
            <div className="text-[11px] uppercase tracking-[0.08em]">
              Centre code {student.center_code}
            </div>
            {centreLines.map((l) => <div key={l}>{l}</div>)}
            {student.center_phone && <div>Phone: {student.center_phone}</div>}
          </div>
        </div>

        <h1 className="mt-5 text-center text-[19px] font-semibold tracking-[-0.01em]">
          Progress Report
        </h1>
        <p className="mb-5 text-center text-[13px] text-[var(--muted)]">
          Academic session {enrollment?.session_name ?? "—"}
        </p>

        {/* ------------------------------------------------------ student details */}
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {[
              [["Student name", fullName(student)], ["Enrolment no.", student.enrollment_no]],
              [["Class", enrollment ? `${enrollment.class_name}${enrollment.section ? ` · ${enrollment.section}` : ""}` : "Not enrolled"],
               ["Roll no.", enrollment?.roll_no ?? "—"]],
              [["Father's name", student.father_name ?? "—"], ["Mother's name", student.mother_name ?? "—"]],
              [["Date of birth", student.dob ? fmtDate(student.dob) : "—"],
               ["Admitted on", fmtDate(student.admission_date)]],
            ].map((pair, i) => (
              <tr key={i}>
                {pair.map(([label, value]) => (
                  <>
                    <td key={`${label}-l`} className="w-[16%] border border-[#e5e7eb] bg-[#fafaff] px-2.5 py-1.5 text-[var(--muted)]">
                      {label}
                    </td>
                    <td key={`${label}-v`} className="w-[34%] border border-[#e5e7eb] px-2.5 py-1.5 font-medium">
                      {value}
                    </td>
                  </>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* --------------------------------------------------------------- marks */}
        <h2 className="mb-2 mt-6 text-[14px] font-semibold">Test results</h2>
        {!anyGraded ? (
          <p className="rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px] text-[var(--muted)]">
            No test results have been recorded for this session yet.
          </p>
        ) : (
          <>
            {testList.filter((t) => t.graded > 0).map((t) => {
              const pct = t.max > 0 ? percentage(t.obtained, t.max) : null;
              return (
                <div key={t.key} className="mb-5">
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[13px] font-semibold">
                      {t.title}
                      <span className="ml-2 font-normal text-[var(--muted)]">
                        {EXAM_TYPE_LABEL[t.type] ?? t.type} · {fmtDate(t.date)}
                      </span>
                    </h3>
                    <span className="text-[12px] text-[var(--muted)]">
                      {t.papers.length} subject{t.papers.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[#fafaff]">
                        {["Subject", "Max", "Obtained", "%", "Grade"].map((h, i) => (
                          <th key={h}
                            className={`border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)] ${
                              i >= 1 ? "text-right" : "text-left"}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.papers.map((paper) => {
                        const sp = paper.obtained === null
                          ? null : percentage(paper.obtained, paper.max);
                        const failed = paper.pass !== null && paper.obtained !== null
                          && paper.obtained < paper.pass;
                        return (
                          <tr key={paper.subject}>
                            <td className="border border-[#e5e7eb] px-2.5 py-1.5">{paper.subject}</td>
                            <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">
                              {paper.max}
                            </td>
                            <td className={`border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums ${
                              failed ? "text-[var(--bad)]" : ""}`}>
                              {paper.isAbsent
                                ? "Absent"
                                : paper.obtained === null
                                  ? <span className="text-[var(--faint)]">Not graded</span>
                                  : paper.obtained}
                            </td>
                            <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">
                              {sp === null ? "—" : `${sp}%`}
                            </td>
                            <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right font-medium">
                              {sp === null ? "—" : grade(sp)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-[#fafaff] font-semibold">
                        <td className="border border-[#e5e7eb] px-2.5 py-1.5">Total</td>
                        <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{t.max}</td>
                        <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{t.obtained}</td>
                        <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">
                          {pct === null ? "—" : `${pct}%`}
                        </td>
                        <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right">
                          {pct === null ? "—" : grade(pct)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            <h2 className="mb-2 mt-6 text-[14px] font-semibold">Overall</h2>
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#fafaff]">
                  {["Test", "Type", "Date", "Obtained", "Out of", "%", "Grade"].map((h, i) => (
                    <th key={h}
                      className={`border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)] ${
                        i >= 3 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {testList.filter((t) => t.graded > 0).map((t) => {
                  const pct = t.max > 0 ? percentage(t.obtained, t.max) : null;
                  return (
                    <tr key={t.key}>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5">{t.title}</td>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5">
                        {EXAM_TYPE_LABEL[t.type] ?? t.type}
                      </td>
                      <td className="whitespace-nowrap border border-[#e5e7eb] px-2.5 py-1.5">
                        {fmtDate(t.date)}
                      </td>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{t.obtained}</td>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{t.max}</td>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">
                        {pct === null ? "—" : `${pct}%`}
                      </td>
                      <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right font-medium">
                        {pct === null ? "—" : grade(pct)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#fafaff] font-semibold">
                  <td className="border border-[#e5e7eb] px-2.5 py-1.5" colSpan={3}>
                    Grand total
                  </td>
                  <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{totalObtained}</td>
                  <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">{totalMax}</td>
                  <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right tabular-nums">
                    {overallPct === null ? "—" : `${overallPct}%`}
                  </td>
                  <td className="border border-[#e5e7eb] px-2.5 py-1.5 text-right">
                    {overallPct === null ? "—" : grade(overallPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* ---------------------------------------------------------- attendance */}
        <h2 className="mb-2 mt-6 text-[14px] font-semibold">Attendance</h2>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr>
              <td className="w-[25%] border border-[#e5e7eb] bg-[#fafaff] px-2.5 py-1.5 text-[var(--muted)]">Days marked</td>
              <td className="w-[25%] border border-[#e5e7eb] px-2.5 py-1.5 font-medium tabular-nums">
                {attendance?.marked ?? 0}
              </td>
              <td className="w-[25%] border border-[#e5e7eb] bg-[#fafaff] px-2.5 py-1.5 text-[var(--muted)]">Days present</td>
              <td className="w-[25%] border border-[#e5e7eb] px-2.5 py-1.5 font-medium tabular-nums">
                {attendance?.present ?? 0}{attPct === null ? "" : `  (${attPct}%)`}
              </td>
            </tr>
          </tbody>
        </table>

        {/* --------------------------------------------------------- signatures */}
        <div className="mt-12 grid grid-cols-3 gap-8 text-center text-[12px] text-[var(--muted)]">
          {["Class teacher", "Centre manager", "Parent / guardian"].map((role) => (
            <div key={role}>
              <div className="mb-1.5 border-t border-[#9a9ab0]" />
              {role}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] text-[var(--faint)]">
          Generated on {fmtDate(new Date())} · FreePathshala · {student.center_name}
        </p>
      </div>
    </>
  );
}
