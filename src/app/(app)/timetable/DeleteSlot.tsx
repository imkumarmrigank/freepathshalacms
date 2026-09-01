"use client";
import { useActionState } from "react";
import { deleteSlot } from "./actions";

export default function DeleteSlot({ id }: { id: number }) {
  const [state, action] = useActionState(deleteSlot, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" title={state?.error ?? "Remove this period"}
        className="text-[11px] text-[var(--faint)] hover:text-[var(--bad)]">
        remove
      </button>
    </form>
  );
}
