"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { TEST_STATUS_LABEL, TEST_STATUS_TONE, pct, slotLabel } from "@/lib/staff-test-meta";
import PaperModal from "./PaperModal";

export type Row = {
  id: number; name: string; role: Role; center_name: string | null;
  cycle_month: string; slot: number; tests_per_month: number;
  started_at: string; submitted_at: string | null; status: string;
  score: number | null; total: number; answered: number; minutes: number | null;
  duration_minutes: number;
};

/**
 * The results, one row per paper. A row opens the paper itself — the question
 * an administrator asks of a low score is "which ones did they get wrong?",
 * and that answer should be one click away, not a page away.
 */
export default function ResultRows({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setOpen(r.id)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setOpen(r.id); }}
                    title="Open this paper"
                    className="cursor-pointer hover:bg-[#f7f7fb]">
                    <td>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[12px] text-[var(--muted)]">{ROLE_LABEL[r.role]}</div>
                    </td>
                    <td className="text-[var(--muted)]">{r.center_name ?? "—"}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {new Date(r.cycle_month).toLocaleDateString("en-IN",
                        { month: "short", year: "numeric" })}
                      <div className="text-[12px]">{fmtDate(r.started_at)}</div>
                    </td>
                    <td className="text-[var(--muted)]">{slotLabel(r.slot, r.tests_per_month)}</td>
                    <td className="tabular-nums">
                      {r.status === "in_progress"
                        ? <span className="text-[13px] text-[var(--faint)]">—</span>
                        : <>{r.score ?? 0} of {r.total}
                            <div className="text-[12px] text-[var(--muted)]">
                              {pct(r.score ?? 0, r.total)}%
                            </div></>}
                    </td>
                    <td className="tabular-nums">
                      {r.answered} of {r.total}
                      {r.answered < r.total && r.status !== "in_progress" && (
                        <div className="text-[12px] text-[var(--warn)]">
                          {r.total - r.answered} left unanswered
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {r.minutes == null ? "—" : `${r.minutes} of ${r.duration_minutes} min`}
                    </td>
                    <td>
                      <Badge tone={TEST_STATUS_TONE[r.status]}>
                        {TEST_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
      </tbody>
      {open !== null && <PaperModal testId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
