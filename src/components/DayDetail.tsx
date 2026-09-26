"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import type { DayItem } from "@/lib/day-book";
import type { StaffNote } from "@/lib/day-note-meta";
import StaffNoteView from "@/components/StaffNoteView";

const TONE: Record<string, string> = {
  "Visit filed": "ok", "Suggestion raised": "warn", "Reply written": "info",
  "Claim verified": "ok", "Meeting written up": "ok", "Counselling step": "info",
  "Child referred": "warn", "Centre feedback": "mute",
};

/**
 * What one person did on one day, item by item.
 *
 * The day book answers "how much"; this answers "what" — the visits, the
 * meetings, the children — and it is fetched only when a row is opened, so
 * reading a month costs nothing until somebody asks about a day.
 */
export default function DayDetail({ day, person, load, onClose }: {
  day: string; person: string;
  load: () => Promise<{ items?: DayItem[]; note?: StaffNote | null; error?: string }>;
  onClose: () => void;
}) {
  const [data, setData] =
    useState<{ items?: DayItem[]; note?: StaffNote | null; error?: string } | null>(null);
  const [, start] = useTransition();

  useEffect(() => { start(async () => setData(await load())); }, [load]);

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

  const items = data?.items ?? [];
  const groups = items.reduce<Record<string, DayItem[]>>((g, it) => {
    (g[it.kind] ??= []).push(it);
    return g;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[720px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-center gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{person}</div>
            <div className="mt-0.5 text-[13px] text-[var(--muted)]">
              {fmtDate(day)} · {items.length} thing{items.length === 1 ? "" : "s"} done
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-md px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[#f1f1f8]">
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          {!data ? (
            <p className="text-[13px] text-[var(--muted)]">Fetching the day…</p>
          ) : data.error ? (
            <p className="text-[13px] text-[var(--bad)]">{data.error}</p>
          ) : items.length === 0 && !data.note ? (
            <p className="text-[13px] text-[var(--muted)]">
              Nothing was entered on this day, and nothing was written up.
            </p>
          ) : (
            <div className="space-y-5">
              {/* what the person said about the day comes before what the
                  system counted of it: the account, then the evidence */}
              {data.note && (
                <div>
                  <div className="mb-2 text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">
                    In their own words
                  </div>
                  <StaffNoteView note={data.note} />
                </div>
              )}
              {Object.entries(groups).map(([kind, list]) => (
                <div key={kind}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={TONE[kind] ?? "mute"}>{kind}</Badge>
                    <span className="text-[12px] text-[var(--muted)]">{list.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {list.map((it, i) => (
                      <li key={i}
                        className="rounded-[10px] border border-[var(--border)] px-3.5 py-2.5">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {it.href ? (
                            <Link href={it.href} className="text-[14px] font-medium hover:text-[var(--brand)]">
                              {it.title}
                            </Link>
                          ) : (
                            <span className="text-[14px] font-medium">{it.title}</span>
                          )}
                          {it.centre && it.centre !== it.title && (
                            <span className="text-[12.5px] text-[var(--muted)]">{it.centre}</span>
                          )}
                          {it.at && (
                            <span className="ml-auto font-mono text-[12px] text-[var(--faint)]">
                              {it.at}
                            </span>
                          )}
                        </div>
                        {it.extra && (
                          <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">{it.extra}</div>
                        )}
                        {it.detail && (
                          <p className="mt-1 text-[13px] text-[var(--muted)]">{it.detail}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
