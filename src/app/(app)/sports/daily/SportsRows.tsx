"use client";
import { useCallback, useState } from "react";
import DayDetail from "@/components/DayDetail";
import { fmtDate } from "@/lib/format";
import { loadSportsDay } from "./actions";
import type { SportsDay } from "@/lib/day-book";

/** A row is a day's work in numbers; opening it shows the work itself. */
export default function SportsRows({ rows, centerId }:
  { rows: SportsDay[]; centerId: number | null }) {
  const [open, setOpen] = useState<{ day: string; id: number; name: string } | null>(null);
  const load = useCallback(
    () => loadSportsDay(open!.day, open!.id, centerId), [open, centerId]);
  const hours = (m: number) => (m ? `${Math.floor(m / 60)}h ${m % 60}m` : "—");

  return (
    <>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.day}-${r.teacher_id}-${i}`} tabIndex={0}
            onClick={() => setOpen({ day: r.day, id: r.teacher_id, name: r.teacher })}
            onKeyDown={(e) => { if (e.key === "Enter")
              setOpen({ day: r.day, id: r.teacher_id, name: r.teacher }); }}
            title="See what was done that day"
            className="cursor-pointer hover:bg-[#f7f7fb]">
            <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
            <td>{r.teacher}</td>
            <td className="tabular-nums">
              {r.visits || "—"}
              {r.visits > r.reports_filed && (
                <div className="text-[12px] text-[var(--warn)]">
                  {r.visits - r.reports_filed} without a report
                </div>
              )}
            </td>
            <td className="max-w-[200px] text-[13px] text-[var(--muted)]">{r.centres ?? "—"}</td>
            <td className="tabular-nums text-[var(--muted)]">{r.children_seen || "—"}</td>
            <td className="whitespace-nowrap text-[var(--muted)]">{hours(r.minutes)}</td>
            <td className="tabular-nums">
              {r.sessions || "—"}
              {r.attendance_marked > 0 && (
                <div className="text-[12px] text-[var(--muted)]">
                  {r.attendance_marked} marks
                </div>
              )}
            </td>
            <td className="tabular-nums">{r.tests || "—"}</td>
            <td className="tabular-nums">{r.marks || "—"}</td>
            <td className="tabular-nums text-[var(--muted)]">{r.remarks || "—"}</td>
          </tr>
        ))}
      </tbody>
      {open && (
        <DayDetail day={open.day} person={open.name} load={load}
          onClose={() => setOpen(null)} />
      )}
    </>
  );
}
