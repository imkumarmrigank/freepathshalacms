"use client";
import { useCallback, useState } from "react";
import DayDetail from "@/components/DayDetail";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { loadMentorDay } from "./actions";
import type { MentorDay } from "@/lib/day-book";

/**
 * The day book's rows. A row is a day's work in numbers; opening it shows the
 * work itself — which child, which meeting, what was written.
 */
export default function MentorRows({ rows, centerId, notes }:
  { notes: Set<string>; rows: MentorDay[]; centerId: number | null }) {
  const [open, setOpen] = useState<{ day: string; id: number; name: string } | null>(null);
  const load = useCallback(
    () => loadMentorDay(open!.day, open!.id, centerId), [open, centerId]);

  return (
    <>
      <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.day}-${r.mentor_id}-${i}`} tabIndex={0}
                    onClick={() => setOpen({ day: r.day, id: r.mentor_id, name: r.mentor })}
                    onKeyDown={(e) => { if (e.key === "Enter")
                      setOpen({ day: r.day, id: r.mentor_id, name: r.mentor }); }}
                    title="See what was done that day"
                    className="cursor-pointer hover:bg-[#f7f7fb]">
                    <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
                    <td>{r.mentor}</td>
                    <td className="tabular-nums">
                      {r.written_up || "—"}
                      {r.met_today > 0 && r.met_today !== r.written_up && (
                        <div className="text-[12px] text-[var(--muted)]">
                          {r.met_today} held that day
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[13px]">
                      {r.meeting_dates === 0 ? <span className="text-[var(--faint)]">—</span>
                        : r.meeting_dates === 1 && r.oldest_meeting === r.day
                          ? <span className="text-[var(--muted)]">the same day</span>
                          : <>
                              <span className="text-[var(--muted)]">
                                {r.meeting_dates} date{r.meeting_dates === 1 ? "" : "s"}
                              </span>
                              {r.oldest_meeting && r.oldest_meeting < r.day && (
                                <div className="mt-0.5">
                                  <Badge tone="warn">back to {fmtDate(r.oldest_meeting)}</Badge>
                                </div>
                              )}
                            </>}
                    </td>
                    <td className="max-w-[200px] text-[13px] text-[var(--muted)]">
                      {r.centres ?? "—"}
                    </td>
                    <td className="tabular-nums text-[var(--muted)]">{r.children || "—"}</td>
                    <td className="tabular-nums">{r.follow_ups_promised || "—"}</td>
                    <td className="tabular-nums">{r.flags_raised || "—"}</td>
                    <td className="tabular-nums">{r.counselling_steps || "—"}</td>
                    <td className="tabular-nums text-[var(--muted)]">{r.feedback || "—"}</td>
                              <td>
              {notes.has(`${r.day}|${r.mentor_id}`)
                ? <Badge tone="ok">Written up</Badge>
                : <span className="text-[13px] text-[var(--faint)]">not written</span>}
            </td>
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
