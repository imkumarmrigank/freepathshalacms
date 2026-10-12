"use client";

import { useActionState } from "react";
import { markVisitMissed } from "./actions";

type Props = { visitId: number };

const init = { error: null as string | null, ok: false };

export default function MissedVisit({ visitId }: Props) {
  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await markVisitMissed(fd);
      if (res.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  if (state.ok) {
    return <span className="text-[12px] text-[var(--bad)]">Marked as missed</span>;
  }

  return (
    <form action={action} className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="visitId" value={visitId} />
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-[var(--muted)] mb-0.5">Why was it missed?</label>
          <input
            type="text"
            name="reason"
            required
            placeholder="e.g. Centre was closed, travel issue…"
            className="w-full rounded border border-[var(--border)] px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-ghost text-[12px] py-1 px-3 h-auto text-[var(--bad)] border-[var(--bad)] hover:bg-red-50"
          >
            {pending ? "Saving…" : "Mark missed"}
          </button>
        </div>
      </div>
      {state.error && (
        <p className="text-[12px] text-[var(--bad)]">{state.error}</p>
      )}
    </form>
  );
}
