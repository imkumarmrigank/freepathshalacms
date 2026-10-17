"use client";
import { useActionState } from "react";
import { cancelVisit } from "./actions";

const init = { error: null as string | null, ok: false };

export default function CancelVisit({ visitId }: { visitId: number }) {
  const [state, action, pending] = useActionState(
    async (_prev: typeof init, fd: FormData) => {
      const res = await cancelVisit(null, fd);
      if (res?.error) return { error: res.error, ok: false };
      return { error: null, ok: true };
    },
    init,
  );

  if (state.ok) return <span className="text-[12px] text-[var(--muted)]">Cancelled</span>;

  return (
    <form action={action} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="visit_id" value={visitId} />
      <button type="submit" disabled={pending}
        className="text-[12.5px] text-[var(--bad)] hover:underline disabled:opacity-50">
        {pending ? "Cancelling…" : "Cancel visit"}
      </button>
      {state.error && <span className="ml-2 text-[12px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}
