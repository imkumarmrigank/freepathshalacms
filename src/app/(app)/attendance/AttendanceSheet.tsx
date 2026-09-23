"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveAttendance } from "./actions";
import { Avatar } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import {
  ABSENT_REASONS, LEAVE_REASONS, LEGACY_STATUS_LABEL, MARKABLE, MARK_OPTIONS,
  needsReason, reasonRequiredOn, reasonsFor,
} from "@/lib/attendance-meta";
import FlagMark from "@/components/FlagMark";

export type Row = {
  enrollment_id: number; student_id: number; enrollment_no: string;
  first_name: string; last_name: string | null; roll_no: number | null;
  section: string | null;
  status: string | null;
  reason: string | null;
  flag_status: string | null; flag_urgency: string | null;
};

const OPTIONS = MARK_OPTIONS;

const SAME_DAY_ONLY = new Set(["present", "late", "half_day"]);

export default function AttendanceSheet({
  rows, attDate, sessionId, classLevelId, centerId, locked, isPast, showSection = false,
}: {
  rows: Row[]; attDate: string; sessionId: number;
  classLevelId: number; centerId: number; locked: boolean; isPast: boolean;
  /** Both sections on one sheet: say which each child is in. */
  showSection?: boolean;
}) {
  const [state, action] = useActionState(saveAttendance, null);
  const [marks, setMarks] = useState<Record<number, string>>(
    () => Object.fromEntries(
      rows.map((r) => [r.enrollment_id, r.status ?? (isPast ? "absent" : "present")]),
    ),
  );

  // what was saved, so a record left untouched is not asked for a reason again
  const saved = Object.fromEntries(rows.map((r) => [r.enrollment_id, r]));
  const [reasons, setReasons] = useState<Record<number, string>>(
    () => Object.fromEntries(rows.map((r) => [r.enrollment_id, r.reason ?? ""])),
  );

  // A mark the register already holds stays settable, even on a closed day:
  // pressing it changes nothing, and disabling it would strand the row.
  const disabledFor = (id: number, value: string) =>
    locked || (isPast && SAME_DAY_ONLY.has(value) && saved[id]?.status !== value);

  /** Changing the mark to one with a different list of reasons clears the old choice. */
  const mark = (id: number, value: string) => {
    setMarks((m) => ({ ...m, [id]: value }));
    setReasons((r) => (reasonsFor(value).includes(r[id]) ? r : { ...r, [id]: "" }));
  };

  /** A reason is owed when absent or leave was set now, not merely left as saved. */
  const required = reasonRequiredOn(attDate);
  const owes = (id: number) => {
    if (!required) return false;
    const status = marks[id];
    if (!needsReason(status) || reasons[id]) return false;
    const was = saved[id];
    return !(was && was.status === status && !was.reason);
  };
  const owing = rows.filter((r) => owes(r.enrollment_id)).length;
  const absentIds = rows.filter((r) => marks[r.enrollment_id] === "absent").map((r) => r.enrollment_id);
  const leaveIds = rows.filter((r) => marks[r.enrollment_id] === "leave").map((r) => r.enrollment_id);
  const applyToAll = (ids: number[], reason: string) =>
    setReasons((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, reason])) }));

  const setAll = (value: string) => rows.forEach((r) => mark(r.enrollment_id, value));

  const counts = OPTIONS.map((o) => ({
    ...o, n: Object.values(marks).filter((v) => v === o.value).length,
  }));
  // Anything the register holds from before the two-button register — shown so
  // the totals across the top still add up to the class.
  const older = Object.values(marks).filter((v) => !MARKABLE.has(v)).length;

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
            {older > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--faint)]" />
                <span className="text-[var(--muted)]">Older marks</span>
                <strong className="tabular-nums">{older}</strong>
              </span>
            )}
          </div>
          {!locked && (absentIds.length > 1 || leaveIds.length > 1) && (
            <div className="flex flex-wrap gap-2">
              {absentIds.length > 1 && (
                <select className="select w-auto py-1 text-[12.5px]" value=""
                  aria-label="Reason for every absent student"
                  onChange={(e) => e.target.value && applyToAll(absentIds, e.target.value)}>
                  <option value="">Reason for all {absentIds.length} absent…</option>
                  {ABSENT_REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
              {leaveIds.length > 1 && (
                <select className="select w-auto py-1 text-[12.5px]" value=""
                  aria-label="Reason for every student on leave"
                  onChange={(e) => e.target.value && applyToAll(leaveIds, e.target.value)}>
                  <option value="">Reason for all {leaveIds.length} on leave…</option>
                  {LEAVE_REASONS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              )}
            </div>
          )}
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
                          <FlagMark status={r.flag_status} urgency={r.flag_urgency} />
                        </Link>
                        <div className="font-mono text-[11px] text-[var(--faint)]">
                          {r.enrollment_no}
                          {showSection && r.section && (
                            <span className="ml-1.5 rounded border border-[var(--border)] px-1 font-sans font-semibold text-[var(--muted)]">
                              {r.section}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* the moment a teacher notices something is while they are
                          looking at the class, so the referral starts here — and
                          a child already referred shows that instead, since a
                          second referral would only be refused */}
                      <Link href={`/students/${r.student_id}${r.flag_status ? "" : "?flag=1"}`}
                        title={r.flag_status
                          ? "Already flagged for counselling — open the referral"
                          : "Flag for counselling"}
                        className={`ml-auto flex-none rounded-lg border px-2 py-1 text-[13px] leading-none ${
                          r.flag_status
                            ? "border-[var(--warn)] bg-[var(--warn-soft)] text-[#b45309]"
                            : "border-[var(--border)] text-[var(--faint)] hover:border-[var(--warn)] hover:text-[var(--warn)]"}`}>
                        &#9873;
                      </Link>
                    </div>
                  </td>
                  <td>
                    <input type="hidden" name={`st_${r.enrollment_id}`} value={marks[r.enrollment_id]} />
                    <input type="hidden" name={`rs_${r.enrollment_id}`} value={reasons[r.enrollment_id] ?? ""} />
                    <div className="flex items-center justify-end gap-1">
                      {!MARKABLE.has(marks[r.enrollment_id]) && (
                        <span className="mr-1 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]"
                          title="Recorded before the register was simplified — press P or A to change it">
                          {LEGACY_STATUS_LABEL[marks[r.enrollment_id]] ?? marks[r.enrollment_id]}
                        </span>
                      )}
                      {OPTIONS.map((o) => {
                        const on = marks[r.enrollment_id] === o.value;
                        return (
                          <button
                            key={o.value} type="button"
                            disabled={disabledFor(r.enrollment_id, o.value)}
                            title={disabledFor(r.enrollment_id, o.value) && !locked
                              ? `${o.title} can only be marked on the day itself`
                              : o.title}
                            onClick={() => mark(r.enrollment_id, o.value)}
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
                    {needsReason(marks[r.enrollment_id]) && (
                      <div className="mt-1.5 flex justify-end">
                        <select
                          className="select w-auto py-1 text-[12.5px]"
                          aria-label={`Reason for ${r.first_name}`}
                          disabled={locked}
                          value={reasons[r.enrollment_id] ?? ""}
                          onChange={(e) => setReasons((x) => ({ ...x, [r.enrollment_id]: e.target.value }))}
                          style={owes(r.enrollment_id) ? { borderColor: "var(--bad)" } : undefined}>
                          <option value="">
                            {marks[r.enrollment_id] === "leave" ? "Reason for leave" : "Reason for absence"}
                            {required ? "…" : " (optional)"}
                          </option>
                          {reasonsFor(marks[r.enrollment_id]).map((x) =>
                            <option key={x} value={x}>{x}</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!locked && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {owing > 0 && (
            <span className="w-full text-[13px] font-medium text-[var(--bad)]">
              Choose a reason for {owing} student{owing === 1 ? "" : "s"} marked absent or on leave.
            </span>
          )}
          <Submit>Save attendance</Submit>
          <span className="text-[13px] text-[var(--muted)]">
            {isPast
              ? "This day is closed — present can only be given on the day itself."
              : "Saving again for the same date overwrites the earlier entry."}
          </span>
        </div>
      )}
    </form>
  );
}
