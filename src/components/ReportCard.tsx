import { Fragment } from "react";
import Image from "next/image";
import { fmtDate, fullName } from "@/lib/format";
import { EXAM_TYPE_LABEL, conductLabel, grade, percentage } from "@/lib/exam-meta";
import type { ReportCardData } from "@/lib/report-card";

const cell = "border border-[#e5e7eb] px-2.5 py-1.5";
const headCell =
  "border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)]";

function Head({ labels, rightFrom }: { labels: string[]; rightFrom: number }) {
  return (
    <thead>
      <tr className="bg-[#fafaff]">
        {labels.map((h, i) => (
          <th key={h} className={`${headCell} ${i >= rightFrom ? "text-right" : "text-left"}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** One student's progress report, laid out for A4. */
export default function ReportCard({ data }: { data: ReportCardData }) {
  const { student, enrollment, tests, totalObtained, totalMax, overallPct, anyGraded,
    anyCo, attendance } = data;

  const centreLines = [
    student.center_address,
    [student.center_area, student.center_city].filter(Boolean).join(", "),
    [student.center_state, student.center_pincode].filter(Boolean).join(" "),
  ].filter((l) => l && l.trim() !== "");

  // Every test the class sat, not only the ones this child scored in. A term
  // where a child was absent is part of their record — dropping it silently
  // made April and May disappear from a card and left the year looking shorter
  // than it was.
  const graded = tests;

  // Subjects down the page, every term across it, on one grid. Each cell
  // carries its own maximum because the terms are not marked on one scale — a
  // monthly is out of 10 and the August final out of 50, and a bare "39" would
  // mean nothing without knowing which.
  const subjects: string[] = [];
  for (const t of graded) {
    for (const p of t.papers) if (!subjects.includes(p.subject)) subjects.push(p.subject);
  }

  return (
    <div className="sheet report-sheet card card-pad bg-white"
      style={{ maxWidth: 1120, margin: "0 auto" }}>
      {/* ------------------------------------------------------------ letterhead */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-[var(--brand)] pb-4">
        <Image src="/logo.png" alt="Pehchaan" width={500} height={153}
          className="h-auto w-[150px]" />
        <div className="text-right text-[12px] leading-relaxed text-[var(--muted)]">
          <div className="text-[15px] font-semibold text-[var(--text)]">{student.center_name}</div>
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

      {/* -------------------------------------------------------- student details */}
      <div className="flex items-start gap-4">
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {([
            [["Student name", fullName(student)], ["Enrolment no.", student.enrollment_no]],
            [["Class", enrollment
                ? `${enrollment.class_name}${enrollment.section ? ` · ${enrollment.section}` : ""}`
                : "Not enrolled"],
             ["Roll no.", enrollment?.roll_no ?? "—"]],
            [["Father's name", student.father_name ?? "—"],
             ["Mother's name", student.mother_name ?? "—"]],
            [["Date of birth", student.dob ? fmtDate(student.dob) : "—"],
             ["Admitted on", fmtDate(student.admission_date)]],
          ] as [string, string | number][][]).map((pair, i) => (
            <tr key={i}>
              {pair.map(([label, value]) => (
                <Fragment key={label}>
                  <td className={`w-[16%] ${cell} bg-[#fafaff] text-[var(--muted)]`}>{label}</td>
                  <td className={`w-[34%] ${cell} font-medium`}>{value}</td>
                </Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {student.photo_media_id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${student.photo_media_id}`} alt={fullName(student)}
          width={96} height={116}
          className="flex-none rounded-[6px] border border-[#e5e7eb] object-cover"
          style={{ width: 96, height: 116 }} />
      )}
      </div>

      {/* ---------------------------------------------------------------- results */}
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">Test results</h2>
      {!anyGraded ? (
        <p className="rounded-[9px] bg-[#fafaff] px-3.5 py-3 text-[13px] text-[var(--muted)]">
          No test results have been recorded for this session yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="mb-5 w-full border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-[#fafaff]">
                  <th className={`${headCell} text-left`} rowSpan={2}>Subject</th>
                  {graded.map((t) => (
                    <th key={t.key} colSpan={3}
                      className={`${headCell} border-l-2 border-l-[#d4d4e0] text-center`}>
                      {t.title}
                      <span className="block font-normal normal-case tracking-normal">
                        {fmtDate(t.date)}
                      </span>
                    </th>
                  ))}
                </tr>
                <tr className="bg-[#fafaff]">
                  {graded.map((t) => (
                    <Fragment key={t.key}>
                      <th className={`${headCell} border-l-2 border-l-[#d4d4e0] text-right`}>Max</th>
                      <th className={`${headCell} text-right`}>Obt</th>
                      <th className={`${headCell} text-right`}>%</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub) => (
                  <tr key={sub}>
                    <td className={`${cell} whitespace-nowrap`}>{sub}</td>
                    {graded.map((t) => {
                      const p = t.papers.find((x) => x.subject === sub);
                      const pct = p && p.obtained !== null ? percentage(p.obtained, p.max) : null;
                      const failed = p && p.pass !== null && p.obtained !== null
                        && p.obtained < p.pass;
                      return (
                        <Fragment key={t.key}>
                          <td className={`${cell} border-l-2 border-l-[#d4d4e0] text-right tabular-nums`}>
                            {p ? p.max : "—"}
                          </td>
                          <td className={`${cell} text-right tabular-nums ${failed ? "text-[var(--bad)]" : ""}`}>
                            {!p ? "—"
                              : p.isAbsent ? "Ab"
                              : p.obtained === null
                                ? <span className="text-[var(--faint)]">—</span>
                                : p.obtained}
                          </td>
                          <td className={`${cell} text-right tabular-nums`}>
                            {pct === null ? "—" : `${pct}%`}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-[#fafaff] font-semibold">
                  <td className={cell}>Total</td>
                  {graded.map((t) => {
                    const pct = t.max > 0 ? percentage(t.obtained, t.max) : null;
                    return (
                      <Fragment key={t.key}>
                        <td className={`${cell} border-l-2 border-l-[#d4d4e0] text-right tabular-nums`}>
                          {t.graded > 0 ? t.max : "—"}
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>
                          {t.graded > 0 ? t.obtained : "—"}
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>
                          {pct === null ? "—" : `${pct}%`}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
                <tr>
                  <td className={`${cell} text-[var(--muted)]`}>Grade</td>
                  {graded.map((t) => {
                    const pct = t.max > 0 ? percentage(t.obtained, t.max) : null;
                    return (
                      <td key={t.key} colSpan={3}
                        className={`${cell} border-l-2 border-l-[#d4d4e0] text-right font-medium`}>
                        {pct === null ? "—" : grade(pct)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 mt-6 text-[14px] font-semibold">Overall</h2>
          <table className="w-full border-collapse text-[12.5px]">
            <Head labels={["Test", "Type", "Date", "Obtained", "Out of", "%", "Grade"]} rightFrom={3} />
            <tbody>
              {graded.map((t) => {
                const pct = t.max > 0 ? percentage(t.obtained, t.max) : null;
                return (
                  <tr key={t.key}>
                    <td className={cell}>{t.title}</td>
                    <td className={cell}>{EXAM_TYPE_LABEL[t.type] ?? t.type}</td>
                    <td className={`${cell} whitespace-nowrap`}>{fmtDate(t.date)}</td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {t.graded > 0 ? t.obtained : "—"}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {t.graded > 0 ? t.max : "—"}
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {pct === null ? "—" : `${pct}%`}
                    </td>
                    <td className={`${cell} text-right font-medium`}>
                      {pct === null ? "—" : grade(pct)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#fafaff] font-semibold">
                <td className={cell} colSpan={3}>Grand total</td>
                <td className={`${cell} text-right tabular-nums`}>{totalObtained}</td>
                <td className={`${cell} text-right tabular-nums`}>{totalMax}</td>
                <td className={`${cell} text-right tabular-nums`}>
                  {overallPct === null ? "—" : `${overallPct}%`}
                </td>
                <td className={`${cell} text-right`}>
                  {overallPct === null ? "—" : grade(overallPct)}
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* -------------------------------------------------- activities & conduct */}
      {anyCo && (
        <>
          <h2 className="mb-2 mt-6 text-[14px] font-semibold">Activities &amp; conduct</h2>
          <p className="mb-2 text-[12px] text-[var(--muted)]">
            Recorded alongside each test, and deliberately kept out of the marks
            total above — how a child behaves is worth knowing, not worth adding
            to their English score.
          </p>
          <table className="w-full border-collapse text-[12.5px]">
            <Head labels={["Test", "Date", "Item", "Max", "Recorded", "Reading"]} rightFrom={3} />
            <tbody>
              {tests.flatMap((t) =>
                t.co
                  .filter((p) => p.obtained !== null || p.isAbsent)
                  .map((p, i) => (
                    <tr key={`${t.key}-${p.subject}`}>
                      <td className={cell}>{i === 0 ? t.title : ""}</td>
                      <td className={`${cell} whitespace-nowrap`}>
                        {i === 0 ? fmtDate(t.date) : ""}
                      </td>
                      <td className={cell}>{p.subject}</td>
                      <td className={`${cell} text-right tabular-nums`}>{p.max}</td>
                      <td className={`${cell} text-right tabular-nums`}>
                        {p.isAbsent
                          ? "Absent"
                          : p.obtained === null
                            ? <span className="text-[var(--faint)]">—</span>
                            : p.obtained}
                      </td>
                      <td className={`${cell} text-right font-medium`}>
                        {p.isAbsent ? "—" : conductLabel(p.obtained, p.max) ?? "—"}
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </>
      )}

      {/* ------------------------------------------------------------- attendance */}
      <h2 className="mb-2 mt-6 text-[14px] font-semibold">Attendance</h2>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          <tr>
            <td className={`w-[25%] ${cell} bg-[#fafaff] text-[var(--muted)]`}>Days marked</td>
            <td className={`w-[25%] ${cell} font-medium tabular-nums`}>{attendance.marked}</td>
            <td className={`w-[25%] ${cell} bg-[#fafaff] text-[var(--muted)]`}>Days present</td>
            <td className={`w-[25%] ${cell} font-medium tabular-nums`}>
              {attendance.present}{attendance.pct === null ? "" : `  (${attendance.pct}%)`}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ------------------------------------------------------------- signatures */}
      <div className="mt-12 grid grid-cols-3 gap-8 text-center text-[12px] text-[var(--muted)]">
        {["Class teacher", "Centre manager", "Parent / guardian"].map((role) => (
          <div key={role}>
            <div className="mb-1.5 border-t border-[#9a9ab0]" />
            {role}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[11px] text-[var(--faint)]">
        Generated on {fmtDate(new Date())} · Pehchaan · {student.center_name}
      </p>
    </div>
  );
}
