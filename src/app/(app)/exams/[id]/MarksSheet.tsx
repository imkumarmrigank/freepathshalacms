"use client";
import { useActionState, useState } from "react";
import { saveMarks } from "../actions";
import { Avatar, Badge } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { grade, percentage } from "@/lib/exam-meta";

export type MarkRow = {
  student_id: number; enrollment_no: string; first_name: string; last_name: string | null;
  roll_no: number | null; marks_obtained: string | null; is_absent: boolean;
};

export default function MarksSheet({
  rows, examId, maxMarks, passMarks, readOnly,
}: {
  rows: MarkRow[]; examId: number; maxMarks: number;
  passMarks: number | null; readOnly: boolean;
}) {
  const [state, action] = useActionState(saveMarks, null);
  const [marks, setMarks] = useState<Record<number, string>>(
    () => Object.fromEntries(rows.map((r) => [
      r.student_id, r.marks_obtained === null ? "" : String(Number(r.marks_obtained)),
    ])),
  );
  const [absent, setAbsent] = useState<Record<number, boolean>>(
    () => Object.fromEntries(rows.map((r) => [r.student_id, r.is_absent])),
  );

  const scored = rows
    .map((r) => (absent[r.student_id] ? null : Number(marks[r.student_id])))
    .filter((n): n is number => n !== null && Number.isFinite(n) && marks !== null);

  const entered = rows.filter(
    (r) => absent[r.student_id] || marks[r.student_id] !== "").length;
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
  const passed = passMarks === null ? null : scored.filter((n) => n >= passMarks).length;
  const over = rows.filter((r) => Number(marks[r.student_id]) > maxMarks).length;

  return (
    <form action={action}>
      <input type="hidden" name="exam_id" value={examId} />
      <FormMessage state={state} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[var(--muted)]">
              Entered <strong className="tabular-nums text-[var(--text)]">{entered}/{rows.length}</strong>
            </span>
            <span className="text-[var(--muted)]">
              Average{" "}
              <strong className="tabular-nums text-[var(--text)]">
                {avg === null ? "—" : `${Math.round(avg * 10) / 10}/${maxMarks}`}
              </strong>
            </span>
            {passed !== null && (
              <span className="text-[var(--muted)]">
                Passed <strong className="tabular-nums text-[var(--text)]">{passed}/{scored.length}</strong>
              </span>
            )}
          </div>
          {over > 0 && (
            <span className="text-[var(--bad)]">
              {over} entr{over === 1 ? "y is" : "ies are"} above the maximum of {maxMarks}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-12">Roll</th>
                <th>Student</th>
                <th className="w-32 text-right">Marks / {maxMarks}</th>
                <th className="w-24 text-right">%</th>
                <th className="w-20 text-right">Grade</th>
                <th className="w-24 text-right">Absent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isAbsent = absent[r.student_id];
                const raw = marks[r.student_id];
                const value = raw === "" || isAbsent ? null : Number(raw);
                const pct = value === null || !Number.isFinite(value)
                  ? null : percentage(value, maxMarks);
                const tooHigh = value !== null && value > maxMarks;
                const failed = passMarks !== null && value !== null && value < passMarks;
                return (
                  <tr key={r.student_id}>
                    <td className="tabular-nums text-[var(--muted)]">{r.roll_no ?? i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={`${r.first_name} ${r.last_name ?? ""}`} size={30} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {r.first_name} {r.last_name ?? ""}
                          </div>
                          <div className="font-mono text-[11px] text-[var(--faint)]">
                            {r.enrollment_no}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right">
                      <input
                        name={`m_${r.student_id}`}
                        className="input w-24 text-right tabular-nums"
                        inputMode="decimal" type="number" min={0} max={maxMarks} step="0.5"
                        disabled={readOnly || isAbsent}
                        value={isAbsent ? "" : raw}
                        placeholder={isAbsent ? "—" : ""}
                        style={tooHigh ? { borderColor: "var(--bad)" } : undefined}
                        onChange={(e) =>
                          setMarks((m) => ({ ...m, [r.student_id]: e.target.value }))}
                      />
                    </td>
                    <td className="text-right tabular-nums text-[var(--muted)]">
                      {pct === null ? "—" : `${pct}%`}
                    </td>
                    <td className="text-right">
                      {isAbsent
                        ? <Badge tone="mute">Absent</Badge>
                        : pct === null
                          ? <span className="text-[var(--faint)]">—</span>
                          : <Badge tone={failed ? "bad" : pct >= 60 ? "ok" : "warn"} dot={false}>
                              {grade(pct)}
                            </Badge>}
                    </td>
                    <td className="text-right">
                      <input type="checkbox" name={`a_${r.student_id}`} className="h-4 w-4"
                        disabled={readOnly}
                        checked={isAbsent}
                        onChange={(e) =>
                          setAbsent((a) => ({ ...a, [r.student_id]: e.target.checked }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Submit>Save marks</Submit>
          <span className="text-[13px] text-[var(--muted)]">
            Leave a box empty for anyone whose marks you do not have yet — you can come back to it.
          </span>
        </div>
      )}
    </form>
  );
}
