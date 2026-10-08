"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { EVENT_LABEL } from "@/lib/calendar-meta";
import type { HolidayRow } from "@/lib/calendar";
import { useT } from "@/components/LocaleProvider";
import WorkingCentres from "./WorkingCentres";
import DeleteHoliday from "./DeleteHoliday";

type Centre = { id: number; code: string; name: string };

/**
 * One row a holiday. Opening a row is how a centre is set to work through it —
 * the override belongs to the holiday, so it is edited where the holiday is,
 * not on a screen of its own.
 */
export default function HolidayRows({ rows, centres }: {
  rows: HolidayRow[]; centres: Centre[];
}) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <ul>
      {rows.map((r) => {
        const showing = open === r.id;
        const run = Number(r.days) > 1;
        return (
          <li key={r.id} className="border-t border-[#f1f1f6] first:border-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
              <div className="min-w-[8.5rem]">
                <div className="font-medium tabular-nums">{fmtDate(r.start_date)}</div>
                {run && (
                  <div className="text-[12px] text-[var(--muted)]">
                    {t("to {d}", { d: fmtDate(r.end_date) })} · {t("{n} days", { n: r.days })}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
                  <Badge tone={r.event_type === "closure" ? "mute" : "bad"} dot={false}>
                    {t(EVENT_LABEL[r.event_type] ?? r.event_type)}
                  </Badge>
                  {r.center_name
                    ? <span>{r.center_name} {t("only")}</span>
                    : <span>{t("every centre")}</span>}
                  {!r.affects_attendance && <span>· {t("register stays open")}</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {r.open_centres.length > 0 && (
                  <span className="rounded-full bg-[var(--ok-soft)] px-2 py-0.5 text-[12px]
                    font-medium text-[var(--ok)]">
                    {r.open_centres.length === 1
                      ? t("{n} centre working", { n: r.open_centres.length })
                      : t("{n} centres working", { n: r.open_centres.length })}
                  </span>
                )}
                <button type="button" onClick={() => setOpen(showing ? null : r.id)}
                  className="btn btn-ghost btn-sm">
                  {showing ? t("Close") : t("Who is working")}
                </button>
                <DeleteHoliday id={r.id} title={r.title} />
              </div>
            </div>

            {showing && (
              <div className="border-t border-[#f1f1f6] bg-[#fafafd] px-4 py-3.5">
                {r.description && (
                  <p className="mb-2.5 text-[13px] text-[var(--muted)]">{r.description}</p>
                )}
                <WorkingCentres holiday={r} centres={centres} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
