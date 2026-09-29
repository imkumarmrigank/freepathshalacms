"use client";
import { useEffect, useState, useTransition } from "react";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import type { CentreCard } from "@/lib/centre-today";
import { loadCentreDay } from "./actions";

type Loaded = Awaited<ReturnType<typeof loadCentreDay>>;

/**
 * One centre's day, person by person: when each of them was in, what they
 * did, and what they wrote up about it — teachers first, then whoever else
 * came to the centre that day.
 */
export default function CentrePanel({ centre, on, onClose }:
  { centre: CentreCard; on: string; onClose: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => setData(await loadCentreDay(centre.id, on)));
  }, [centre.id, on]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const people = data && "people" in data ? data.people : [];
  const failed = data && "error" in data ? data.error : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[760px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-start gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{centre.name}</div>
            <div className="mt-0.5 text-[13px] text-[var(--muted)]">
              {centre.code} · {fmtDate(on)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <Num n={centre.roll ? `${centre.present}/${centre.roll}` : "—"} of="children" />
            <Num n={`${centre.staff_in}/${centre.staff_on_roll}`} of="staff in" />
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>

        <div className="px-5 py-4">
          {data === null && <p className="text-[13px] text-[var(--muted)]">Loading…</p>}
          {failed && <p className="text-[13px] text-[var(--bad)]">{failed}</p>}
          {data !== null && !failed && people.length === 0 && (
            <p className="text-[13px] text-[var(--muted)]">
              Nobody checked in and nothing was recorded at this centre on this day.
            </p>
          )}

          {people.map((p) => (
            <div key={p.user_id}
              className="mb-3 rounded-[11px] border border-[var(--border)] p-3.5 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-[14px] font-semibold">{p.name}</span>
                  <span className="ml-2 text-[12px] text-[var(--muted)]">
                    {ROLE_LABEL[p.role as Role] ?? p.role}
                  </span>
                </div>
                <div className="text-[12.5px] text-[var(--muted)]">
                  {p.check_in
                    ? <>
                        {p.check_in}–{p.check_out ?? "still in"}
                        {p.minutes != null && ` · ${Math.floor(p.minutes / 60)}h ${p.minutes % 60}m`}
                        {p.by_hand && <span className="ml-1.5 text-[var(--warn)]">by hand</span>}
                        {p.distance_m != null && ` · ${p.distance_m} m out`}
                      </>
                    : <span className="text-[var(--faint)]">no check-in</span>}
                </div>
              </div>

              {p.did.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {p.did.map((d, i) => (
                    <li key={i} className="text-[13px] text-[var(--ink)]">· {d}</li>
                  ))}
                </ul>
              )}

              {p.wrote.length > 0 && (
                <div className="mt-2.5 rounded-[9px] bg-[#f7f7fb] px-3 py-2.5">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide
                    text-[var(--faint)]">
                    In their own words
                  </div>
                  {p.wrote.map((w, i) => (
                    <p key={i} className="text-[13px] leading-[1.5]">
                      <span className="text-[var(--muted)]">{w.label}:</span> {w.text}
                    </p>
                  ))}
                </div>
              )}

              {p.did.length === 0 && p.wrote.length === 0 && (
                <p className="mt-2 text-[12.5px] text-[var(--faint)]">
                  Checked in, but nothing recorded against the day.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Num({ n, of }: { n: string; of: string }) {
  return (
    <div>
      <div className="text-[15px] font-semibold tabular-nums">{n}</div>
      <div className="text-[11.5px] text-[var(--muted)]">{of}</div>
    </div>
  );
}
