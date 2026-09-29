"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { CentreCard } from "@/lib/centre-today";
import CentrePanel from "./CentrePanel";

/** A card is a centre's day; opening it breaks the day down person by person. */
export default function CentreCards({ rows, on }: { rows: CentreCard[]; on: string }) {
  const [open, setOpen] = useState<CentreCard | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const quiet = r.roll === 0 && r.staff_in === 0;
          const pct = r.roll ? Math.round((r.present / r.roll) * 100) : null;
          return (
            <button key={r.id} type="button" onClick={() => setOpen(r)}
              className="rounded-[13px] border border-[var(--border)] bg-white p-4 text-left
                shadow-[0_1px_2px_rgba(16,16,40,.04)] transition
                hover:border-[var(--brand)] hover:shadow-[0_3px_10px_rgba(16,16,40,.08)]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{r.name}</div>
                  <div className="text-[12px] text-[var(--muted)]">{r.code}</div>
                </div>
                {quiet
                  ? <Badge tone="warn">Nothing yet</Badge>
                  : pct != null && <Badge tone={pct >= 75 ? "ok" : pct >= 50 ? "info" : "warn"}>
                      {pct}% present
                    </Badge>}
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                <Cell top={r.roll ? `${r.present}/${r.roll}` : "—"} label="children" />
                <Cell top={`${r.staff_in}/${r.staff_on_roll}`} label="staff in"
                  hint={r.first_in ? `from ${r.first_in}` : undefined} />
                <Cell top={r.classes_expected
                  ? `${r.classes_marked}/${r.classes_expected}`
                  : String(r.classes_marked)}
                  label="classes marked"
                  hint={r.classes_expected && r.classes_marked < r.classes_expected
                    ? `${r.classes_expected - r.classes_marked} not marked`
                    : undefined} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.ptms > 0 && <Chip>{r.ptms} parent meeting{r.ptms === 1 ? "" : "s"}</Chip>}
                {r.audit_visits > 0 && <Chip tone="info">Audit visit</Chip>}
                {r.sports_visits > 0 && <Chip tone="info">Sports session</Chip>}
                {r.flags > 0 && <Chip tone="warn">{r.flags} flagged</Chip>}
                {r.notes_written > 0 && <Chip>{r.notes_written} written up</Chip>}
                {r.ptms + r.audit_visits + r.sports_visits + r.flags + r.notes_written === 0 && (
                  <span className="text-[12px] text-[var(--faint)]">
                    nothing else recorded
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {open && <CentrePanel centre={open} on={on} onClose={() => setOpen(null)} />}
    </>
  );
}

const CELL_TITLE: Record<string, string> = {
  children: "Children marked present, against the children whose register was filled",
  "staff in": "The centre's own staff who checked in, against the staff on its books",
  "classes marked": "Classes whose attendance register was filled, "
    + "against the classes the centre runs",
};

function Cell({ top, label, hint }: { top: string; label: string; hint?: string }) {
  return (
    <div className="rounded-[9px] bg-[#f7f7fb] px-2 py-2" title={CELL_TITLE[label]}>
      <div className="text-[15px] font-semibold tabular-nums">{top}</div>
      <div className="text-[11.5px] text-[var(--muted)]">{label}</div>
      {hint && <div className="text-[11px] text-[var(--faint)]">{hint}</div>}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  const c = tone === "warn"
    ? "bg-[#fdf6e3] text-[#7a5a12]"
    : tone === "info" ? "bg-[var(--brand-soft)] text-[var(--brand)]"
    : "bg-[#f1f1f8] text-[var(--muted)]";
  return <span className={`rounded-full px-2 py-[3px] text-[11.5px] ${c}`}>{children}</span>;
}
