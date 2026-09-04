"use client";
import { useActionState, useState } from "react";
import { openCentreOnHoliday, closeCentreOnHoliday } from "./actions";
import { FormMessage } from "@/components/form";

/**
 * One centre working through a holiday everybody else is observing. Kept as an
 * exception to the holiday rather than a deletion, so the other eleven centres
 * keep their day off.
 */
export default function KeepOpen({ eventId, centres, openCentres }: {
  eventId: number;
  centres: { id: number; code: string; name: string }[];
  openCentres: string[];
}) {
  const [openState, open] = useActionState(openCentreOnHoliday, null);
  const [, close] = useActionState(closeCentreOnHoliday, null);
  const [showing, setShowing] = useState(false);

  const stillClosed = centres.filter((c) => !openCentres.includes(c.name));

  return (
    <div className="mt-2 w-full">
      <FormMessage state={openState} />

      {openCentres.length > 0 && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-[var(--muted)]">Working that day:</span>
          {openCentres.map((name) => {
            const centre = centres.find((c) => c.name === name);
            return (
              <span key={name}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--ok-soft)] px-2 py-0.5 font-medium text-[var(--ok)]">
                {name}
                {centre && (
                  <form action={close} className="contents">
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="center_id" value={centre.id} />
                    <button type="submit" title={`Put ${name} back on holiday`}
                      className="leading-none opacity-60 hover:opacity-100">×</button>
                  </form>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!showing ? (
        stillClosed.length > 0 && (
          <button type="button" onClick={() => setShowing(true)}
            className="text-[12px] text-[var(--brand)] hover:underline">
            A centre is working that day?
          </button>
        )
      ) : (
        <form action={open} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <label className="min-w-[10rem]">
            <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
              Centre that is working
            </span>
            <select className="select w-auto" name="center_id" defaultValue="" required>
              <option value="" disabled>Select centre</option>
              {stillClosed.map((c) => (
                <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">
              Why (optional)
            </span>
            <input className="input" name="reason" placeholder="Catching up on missed lessons" />
          </label>
          <button className="btn btn-ghost btn-sm mb-[1px] h-[38px]" type="submit">
            Keep open
          </button>
          <button type="button" className="btn btn-ghost btn-sm mb-[1px] h-[38px]"
            onClick={() => setShowing(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
}
