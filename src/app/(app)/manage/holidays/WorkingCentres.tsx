"use client";
import { useActionState } from "react";
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
        <form action={open} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="event_id" value={holiday.id} />
          <label className="min-w-[11rem]">
            <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
              {t("Centre that is working")}
            </span>
            <select className="select w-auto" name="center_id" defaultValue="" required>
              <option value="" disabled>{t("Select centre")}</option>
              {closed.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
              {t("Why (optional)")}
            </span>
            <input className="input" name="reason"
              placeholder={t("Catching up on missed lessons")} />
          </label>
          <button className="btn btn-primary btn-sm mb-[1px] h-[38px]" type="submit">
            {t("Make it a working day")}
          </button>
        </form>
      )}
    </>
  );
}
