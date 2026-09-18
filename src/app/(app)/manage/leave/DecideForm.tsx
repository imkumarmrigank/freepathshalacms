"use client";
import { useActionState } from "react";
import { decideLeave } from "./actions";
import { FormMessage } from "@/components/form";

/** Approve or refuse, with an optional line back to the teacher. */
export default function DecideForm({ id, decided }: { id: number; decided: boolean }) {
  const [state, action] = useActionState(decideLeave, null);

  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <input className="input" name="note" placeholder="Note back to them (optional)" />
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" type="submit" name="decision" value="approved">
          {decided ? "Approve instead" : "Approve"}
        </button>
        <button className="btn btn-ghost btn-sm" type="submit" name="decision" value="rejected">
          {decided ? "Refuse instead" : "Refuse"}
        </button>
      </div>
    </form>
  );
}
