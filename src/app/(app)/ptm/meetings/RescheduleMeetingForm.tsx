"use client";
import { useActionState, useState } from "react";
import { rescheduleMeeting } from "../actions";

type S = { error: string | null; ok: string | null };
const init: S = { error: null, ok: null };

export default function RescheduleMeetingForm({
  meetingId,
  currentDate,
  currentStart,
  currentEnd,
}: {
  meetingId: number;
  currentDate: string;
  currentStart: string | null;
  currentEnd: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: S, fd: FormData): Promise<S> => {
      const res = await rescheduleMeeting(null, fd);
      if (res?.ok) setOpen(false);
      return { error: res?.error ?? null, ok: (res as { ok?: string })?.ok ?? null };
    },
    init,
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-[12.5px] text-[var(--brand)] hover:underline">
        Reschedule
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <input type="hidden" name="meeting_id" value={meetingId} />
      <div className="flex flex-wrap gap-2">
        <label className="block">
          <span className="label-cap mb-1 block">New date</span>
          <input type="date" name="meeting_date" className="input" required
            defaultValue={currentDate} />
        </label>
        <label className="block">
          <span className="label-cap mb-1 block">Start time <span className="font-normal text-[var(--faint)]">(opt)</span></span>
          <input type="time" name="start_time" className="input w-32"
            defaultValue={currentStart ?? ""} />
        </label>
        <label className="block">
          <span className="label-cap mb-1 block">End time <span className="font-normal text-[var(--faint)]">(opt)</span></span>
          <input type="time" name="end_time" className="input w-32"
            defaultValue={currentEnd ?? ""} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        {state.error && <span className="text-[12px] text-[var(--bad)]">{state.error}</span>}
      </div>
    </form>
  );
}
