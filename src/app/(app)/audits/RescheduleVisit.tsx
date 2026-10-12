"use client";

import { useActionState } from "react";
import { rescheduleVisit } from "./actions";

type Props = { visitId: number; currentDate: string };

const init = { error: null as string | null, ok: false };

export default function RescheduleVisit({ visitId, currentDate }: Props) {
  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await rescheduleVisit(null, fd);
      if (res.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  if (state.ok) {
    return <span className="text-[12px] text-[var(--ok)]">Rescheduled</span>;
  }

  return (
    <form action={action} className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="visitId" value={visitId} />
      <div className="flex flex-wrap gap-2">
        <div>
          <label className="block text-[11px] text-[var(--muted)] mb-0.5">New date</label>
          <input
            type="date"
            name="newDate"
            defaultValue={currentDate}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            required
            className="rounded border border-[var(--border)] px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[11px] text-[var(--muted)] mb-0.5">Reason</label>
          <input
            type="text"
            name="reason"
            required
            placeholder="Why is it moving?"
            className="w-full rounded border border-[var(--border)] px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary text-[12px] py-1 px-3 h-auto"
          >
            {pending ? "Saving…" : "Reschedule"}
          </button>
        </div>
      </div>
      {state.error && (
        <p className="text-[12px] text-[var(--bad)]">{state.error}</p>
      )}
    </form>
  );
}
