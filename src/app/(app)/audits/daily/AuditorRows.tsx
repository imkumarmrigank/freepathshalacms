"use client";
import { useCallback, useState } from "react";
import DayDetail from "@/components/DayDetail";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { loadAuditorDay } from "./actions";
import type { AuditorDay } from "@/lib/day-book";

/**
 * The day book's rows. A row is a day's work in numbers; opening it shows the
 * work itself — which visit, which centre, what was asked for.
 */
export default function AuditorRows({ rows, centerId, notes }:
  { notes: Set<string>; rows: AuditorDay[]; centerId: number | null }) {
  const [open, setOpen] = useState<{ day: string; id: number; name: string } | null>(null);
  const load = useCallback(
    () => loadAuditorDay(open!.day, open!.id, centerId), [open, centerId]);

  return (
    <>
      <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.day}-${r.auditor_id}-${i}`} tabIndex={0}
                    onClick={() => setOpen({ day: r.day, id: r.auditor_id, name: r.auditor })}
                    onKeyDown={(e) => { if (e.key === "Enter")
                      setOpen({ day: r.day, id: r.auditor_id, name: r.auditor }); }}
                    title="See what was done that day"
                    className="cursor-pointer hover:bg-[#f7f7fb]">
                    <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
                    <td>{r.auditor}</td>
                    <td className="tabular-nums">
                      {r.visits_filed}
                      {r.visits_made > 0 && r.visits_made !== r.visits_filed && (
                        <div className="text-[12px] text-[var(--muted)]">
                          {r.visits_made} visited that day
                        </div>
                      )}
                    </td>
                    <td className="max-w-[220px] text-[13px] text-[var(--muted)]">
                      {r.centres ?? "—"}
                    </td>
                    <td className="tabular-nums text-[var(--muted)]">{r.children_seen || "—"}</td>
                    <td className="tabular-nums">
                      {r.avg_score == null ? "—" : `${r.avg_score}%`}
                    </td>
                    <td className="tabular-nums">{r.suggestions || "—"}</td>
                    <td className="tabular-nums">{r.replies || "—"}</td>
                    <td className="tabular-nums">{r.verified || "—"}</td>
                    <td className="tabular-nums text-[var(--muted)]">{r.scheduled || "—"}</td>
                              <td>
              {notes.has(`${r.day}|${r.auditor_id}`)
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
