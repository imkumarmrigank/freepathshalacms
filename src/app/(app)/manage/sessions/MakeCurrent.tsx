"use client";
import { useActionState } from "react";
import { setCurrentSession } from "../actions";

export default function MakeCurrent({ id }: { id: number }) {
  const [state, action] = useActionState(setCurrentSession, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.ok ?? ""}>
        Make current
      </button>
    </form>
  );
}
