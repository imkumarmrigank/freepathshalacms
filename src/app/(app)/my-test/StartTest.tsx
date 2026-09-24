"use client";
import { useActionState } from "react";
import { startTest } from "./actions";
import { FormMessage, Submit } from "@/components/form";

/** The one button that draws a paper and starts the clock. */
export default function StartTest({ role, label, note }:
  { role: string; label: string; note: string }) {
  const [state, action] = useActionState(startTest, null);
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="role" value={role} />
      <p className="mb-2.5 text-[13px] text-[var(--muted)]">{note}</p>
      <Submit>{label}</Submit>
    </form>
  );
}
