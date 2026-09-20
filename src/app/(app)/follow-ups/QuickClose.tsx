"use client";
import { useActionState } from "react";
import { closeFollowUp } from "../ptm/actions";

/**
 * Closing from the list itself. A mentor working through a morning's calls
 * should not have to open each record to say it is done — and one closed in
 * error goes straight back on the list.
 */
export default function QuickClose({ id, status }: { id: number; status: string }) {
  const [state, action] = useActionState(closeFollowUp, null);

  return (
    <form action={action} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      {status === "pending" ? (
        <>
          <input className="input h-8 w-[150px] py-1 text-[12.5px]" name="follow_up_notes"
            placeholder="What happened?" aria-label="What happened" />
          <button className="btn btn-primary btn-sm" name="follow_up_status" value="done" type="submit">
            Done
          </button>
          <button className="btn btn-ghost btn-sm" name="follow_up_status" value="cancelled" type="submit">
            Cancel
          </button>
        </>
      ) : (
        <button className="btn btn-ghost btn-sm" name="follow_up_status" value="pending" type="submit">
          Reopen
        </button>
      )}
      {state?.error && <span className="text-[12px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}
