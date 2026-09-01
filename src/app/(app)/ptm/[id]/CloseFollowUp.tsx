"use client";
import { useActionState } from "react";
import { closeFollowUp } from "../actions";
import { FormMessage, Submit } from "@/components/form";

export default function CloseFollowUp({ id }: { id: number }) {
  const [state, action] = useActionState(closeFollowUp, null);
  return (
    <form action={action} className="mt-4 border-t border-[var(--border)] pt-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <label className="field">
        <span>How did the follow-up go?</span>
        <textarea className="textarea" name="follow_up_notes" rows={2}
          placeholder="What happened when you called or visited" />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" name="follow_up_status" value="done" type="submit">
          Mark done
        </button>
        <button className="btn btn-ghost btn-sm" name="follow_up_status" value="cancelled" type="submit">
          Cancel follow-up
        </button>
      </div>
    </form>
  );
}
