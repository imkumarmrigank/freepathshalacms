"use client";
import { useActionState } from "react";
import { deleteEvent } from "./actions";

export default function DeleteEvent({ id }: { id: number }) {
  const [state, action] = useActionState(deleteEvent, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.error ?? "Remove"}>
        Remove
      </button>
    </form>
  );
}
