"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import TeacherDayDetail from "./TeacherDayDetail";
import type { TeacherDay } from "@/lib/day-book";

/** A row is a teacher's day in numbers; opening it shows the day itself. */
export default function TeacherRows({ rows }: { rows: TeacherDay[] }) {
  const [open, setOpen] = useState<{ day: string; id: number; name: string } | null>(null);
  const hours = (m: number | null) =>
    m == null ? "—" : `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.day}-${r.teacher_id}-${i}`} tabIndex={0}
            onClick={() => setOpen({ day: r.day, id: r.teacher_id, name: r.teacher })}
            onKeyDown={(e) => { if (e.key === "Enter")
              setOpen({ day: r.day, id: r.teacher_id, name: r.teacher }); }}
            title="See the whole day"
            className="cursor-pointer hover:bg-[#f7f7fb]">
            <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
            <td>
              {r.teacher}
              {r.center_name && (
                <div className="text-[12px] text-[var(--muted)]">{r.center_name}</div>
              )}
            </td>
            <td className="whitespace-nowrap">
              {r.check_in ?? <span className="text-[var(--faint)]">not in</span>}
              {r.by_hand && <div className="text-[12px] text-[var(--warn)]">by hand</div>}
            </td>
            <td className="whitespace-nowrap text-[var(--muted)]">{r.check_out ?? "—"}</td>
            <td className="whitespace-nowrap text-[var(--muted)]">{hours(r.minutes)}</td>
            <td className="tabular-nums">{r.classes_marked || "—"}</td>
            <td className="tabular-nums">{r.present || "—"}</td>
            <td className="tabular-nums">
              {r.absent || "—"}
              {r.children > 0 && (
                <div className="text-[12px] text-[var(--muted)]">
                  {Math.round((r.present / r.children) * 100)}% in
                </div>
              )}
            </td>
            <td className="max-w-[260px]">
              {r.notes_written > 0
                ? <>
                    <Badge tone="ok">Written up</Badge>
                    {r.chapters && (
                      <div className="mt-0.5 truncate text-[12.5px] text-[var(--muted)]">
                        {r.chapters}
                      </div>
                    )}
                  </>
                : <Badge tone="warn">Not written</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
      {open && (
        <TeacherDayDetail day={open.day} personId={open.id} person={open.name}
          onClose={() => setOpen(null)} />
      )}
    </>
  );
}
