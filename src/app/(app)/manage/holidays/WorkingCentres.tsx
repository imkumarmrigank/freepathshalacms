"use client";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form";
import type { HolidayRow } from "@/lib/calendar";
import { useT } from "@/components/LocaleProvider";
import { openCentreOnHoliday, closeCentreOnHoliday } from "@/app/(app)/calendar/actions";

type Centre = { id: number; code: string; name: string };

/**
 * Which centres work through this holiday.
 *
 * It is kept as an exception to the holiday, never as a second holiday or a
 * deletion: the other centres keep their day off, and taking the exception
 * away puts the centre straight back on holiday.
 */
export default function WorkingCentres({ holiday, centres }: {
  holiday: HolidayRow; centres: Centre[];
}) {
  const t = useT();
  const [openState, open] = useActionState(openCentreOnHoliday, null);
  const [picked, setPicked] = useState<number[]>([]);
  const [closeState, close] = useActionState(closeCentreOnHoliday, null);

  // a holiday posted to one centre has no "other centres" to except
  const forOneCentre = holiday.center_id !== null;
  const working = holiday.open_centres;
  const closed = centres.filter((c) => !working.some((w) => w.id === c.id));

  if (forOneCentre) {
    return (
      <p className="text-[13px] text-[var(--muted)]">
        {t("This holiday was posted for one centre only, so there is nothing to lift. "
          + "Remove it to make that centre work.")}
      </p>
    );
  }

  return (
    <>
      <FormMessage state={openState} />
      <FormMessage state={closeState} />

      {working.length > 0 ? (
        <div className="mb-3">
          <div className="label-cap mb-1.5">{t("Working that day")}</div>
          <ul className="space-y-1.5">
            {working.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="rounded-full bg-[var(--ok-soft)] px-2.5 py-0.5
                  font-medium text-[var(--ok)]">{w.code} · {w.name}</span>
                {w.reason && <span className="text-[var(--muted)]">{w.reason}</span>}
                <form action={close} className="contents">
                  <input type="hidden" name="event_id" value={holiday.id} />
                  <input type="hidden" name="center_id" value={w.id} />
                  <button type="submit" className="btn btn-ghost btn-sm">
                    {t("Put back on holiday")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mb-3 text-[13px] text-[var(--muted)]">
          {t("Every centre is on holiday that day.")}
        </p>
      )}

      {closed.length > 0 && (
        <form action={open}>
          <input type="hidden" name="event_id" value={holiday.id} />

          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-[var(--muted)]">
              {t("Centres that are working")}
            </span>
            <button type="button"
              onClick={() => setPicked(picked.length === closed.length
                ? [] : closed.map((c) => c.id))}
              className="text-[12px] text-[var(--brand)] hover:underline">
              {picked.length === closed.length ? t("Clear all") : t("Select all")}
            </button>
          </div>

          {/* Checkboxes rather than a multi-select: picking four centres out of
              fourteen should not need a held-down key, least of all on a phone. */}
          <div className="mb-3 grid gap-x-4 gap-y-1.5 rounded-[9px] border
            border-[var(--border)] bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="center_id" value={c.id} className="h-4 w-4"
                  checked={picked.includes(c.id)}
                  onChange={(e) => setPicked(e.target.checked
                    ? [...picked, c.id]
                    : picked.filter((id) => id !== c.id))} />
                <span className="truncate">
                  <span className="font-mono text-[11.5px] text-[var(--faint)]">{c.code}</span>
                  {" "}{c.name}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
                {t("Why (optional)")}
              </span>
              <input className="input" name="reason"
                placeholder={t("Catching up on missed lessons")} />
            </label>
            <button className="btn btn-primary btn-sm mb-[1px] h-[38px]" type="submit"
              disabled={picked.length === 0}>
              {picked.length <= 1
                ? t("Make it a working day")
                : t("Make it a working day for {n} centres", { n: picked.length })}
            </button>
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--faint)]">
            {t("The reason is recorded against every centre you tick.")}
          </p>
        </form>
      )}
    </>
  );
}
