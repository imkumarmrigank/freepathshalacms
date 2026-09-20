"use client";
import { useActionState } from "react";
import { closeFollowUp } from "../actions";
import { FormMessage } from "@/components/form";

export default function CloseFollowUp({ id, status }: { id: number; status: string }) {
  const [state, action] = useActionState(closeFollowUp, null);
  const open = status === "pending";

  return (
    <form action={action} className="mt-4 border-t border-[var(--border)] pt-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <label className="field">
        <span>{open ? "How did the follow-up go?" : "Add to the note"}</span>
        <textarea className="textarea" name="follow_up_notes" rows={2}
          placeholder="What happened when you called or visited" />
      </label>
      <div className="flex gap-2">
        {open ? (
          <>
            <button className="btn btn-primary btn-sm" name="follow_up_status" value="done" type="submit">
              Mark done
            </button>
            <button className="btn btn-ghost btn-sm" name="follow_up_status" value="cancelled" type="submit">
              Cancel follow-up
            </button>
          </>
        ) : (
          // closed early, or closed by mistake — either way it goes back on the list
          <button className="btn btn-ghost btn-sm" name="follow_up_status" value="pending" type="submit">
            Reopen follow-up
          </button>
        )}
      </div>
    </form>
  );
}
