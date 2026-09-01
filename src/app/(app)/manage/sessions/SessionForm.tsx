"use client";
import { useActionState } from "react";
import { saveSession } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function SessionForm({
  session, nextSequence,
}: {
  session?: { id: number; name: string; start_date: string; end_date: string; sequence: number } | null;
  nextSequence: number;
}) {
  const [state, action] = useActionState(saveSession, null);
  const d = (v: string | undefined) => (v ? String(v).slice(0, 10) : "");

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">{session ? "Edit session" : "New session"}</h2>
      <form action={action}>
        {session && <input type="hidden" name="id" value={session.id} />}
        <FormMessage state={state} />
        <Field label="Session name *" hint="For example 2027-28">
          <input className="input" name="name" defaultValue={session?.name ?? ""} required />
        </Field>
        <Field label="Starts *">
          <input className="input" type="date" name="start_date" defaultValue={d(session?.start_date)} required />
        </Field>
        <Field label="Ends *">
          <input className="input" type="date" name="end_date" defaultValue={d(session?.end_date)} required />
        </Field>
        <Field label="Order *" hint="Sessions are promoted in this order">
          <input className="input" type="number" name="sequence" min={1}
            defaultValue={session?.sequence ?? nextSequence} required />
        </Field>
        <Submit>{session ? "Save session" : "Create session"}</Submit>
      </form>
    </Card>
  );
}
