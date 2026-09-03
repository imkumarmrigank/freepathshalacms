"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAttendance } from "./actions";
import { Avatar } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export type Row = {
  enrollment_id: number; student_id: number; enrollment_no: string;
  first_name: string; last_name: string | null; roll_no: number | null;
  status: string | null;
};

const OPTIONS = [
  { value: "present", label: "P", title: "Present", color: "var(--ok)" },
  { value: "absent", label: "A", title: "Absent", color: "var(--bad)" },
  { value: "late", label: "L", title: "Late", color: "#eab308" },
  { value: "half_day", label: "H", title: "Half day", color: "#0891b2" },
  { value: "leave", label: "Lv", title: "Leave", color: "var(--muted)" },
];

const SAME_DAY_ONLY = new Set(["present", "late", "half_day"]);

export default function AttendanceSheet({
  rows, attDate, sessionId, classLevelId, centerId, locked, isPast,
}: {
  rows: Row[]; attDate: string; sessionId: number;
  classLevelId: number; centerId: number; locked: boolean; isPast: boolean;
}) {
  const [state, action] = useActionState(saveAttendance, null);
  const [marks, setMarks] = useState<Record<number, string>>(
    () => Object.fromEntries(
      rows.map((r) => [r.enrollment_id, r.status ?? (isPast ? "absent" : "present")]),
    ),
  );

  const disabledFor = (value: string) => locked || (isPast && SAME_DAY_ONLY.has(value));

  const setAll = (value: string) =>
    setMarks(Object.fromEntries(rows.map((r) => [r.enrollment_id, value])));

  const counts = OPTIONS.map((o) => ({
    ...o, n: Object.values(marks).filter((v) => v === o.value).length,
  }));

  return (
    <form action={action}>
      <input type="hidden" name="att_date" value={attDate} />
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="class_level_id" value={classLevelId} />
      <input type="hidden" name="center_id" value={centerId} />
      <FormMessage state={state} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            {counts.map((c) => (
              <span key={c.value} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                <span className="text-[var(--muted)]">{c.title}</span>
                <strong className="tabular-nums">{c.n}</strong>
              </span>
            ))}
          </div>
          {!locked && (
            <div className="flex gap-2">
              {!isPast && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll("present")}>
                  Mark all present
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll("absent")}>
                Mark all absent
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th className="w-12">Roll</th><th>Student</th><th className="text-right">Attendance</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.enrollment_id}>
                  <td className="tabular-nums text-[var(--muted)]">{r.roll_no ?? i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${r.first_name} ${r.last_name ?? ""}`} size={30} />
                      <div className="min-w-0">
                        <Link href={`/students/${r.student_id}`}
                          className="block truncate font-medium hover:text-[var(--brand)]">
                          {r.first_name} {r.last_name ?? ""}
                        </Link>
                        <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                      </div>
                      {/* the moment a teacher notices something is while they are
                          looking at the class, so the referral starts here */}
                      <Link href={`/students/${r.student_id}?flag=1`}
                        title="Flag for counselling"
                        className="ml-auto flex-none rounded-lg border border-[var(--border)] px-2 py-1 text-[13px] leading-none text-[var(--faint)] hover:border-[var(--warn)] hover:text-[var(--warn)]">
                        &#9873;
                      </Link>
                    </div>
                  </td>
                  <td>
                    <input type="hidden" name={`st_${r.enrollment_id}`} value={marks[r.enrollment_id]} />
                    <div className="flex justify-end gap-1">
                      {OPTIONS.map((o) => {
                        const on = marks[r.enrollment_id] === o.value;
                        return (
                          <button
                            key={o.value} type="button" disabled={disabledFor(o.value)}
                            title={disabledFor(o.value) && !locked
                              ? `${o.title} can only be marked on the day itself`
                              : o.title}
                            onClick={() => setMarks((m) => ({ ...m, [r.enrollment_id]: o.value }))}
                            className="h-8 min-w-8 rounded-lg border px-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                            style={on
                              ? { background: o.color, borderColor: o.color, color: "#fff" }
                              : { background: "#fff", borderColor: "var(--border-strong)", color: "var(--muted)" }}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <Submit>Save attendance</Submit>
          <span className="text-[13px] text-[var(--muted)]">
            {isPast
              ? "This day is closed — only leave or absent can be recorded now."
              : "Saving again for the same date overwrites the earlier entry."}
          </span>
        </div>
      )}
    </form>
  );
}
