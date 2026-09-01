"use client";
import { useActionState, useState } from "react";
import { runPromotion } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function PromoteForm({
  sessions, centers, defaultFrom, defaultTo,
}: {
  sessions: { id: number; name: string; is_current: boolean }[];
  centers: { id: number; code: string; name: string }[];
  defaultFrom: number | null;
  defaultTo: number | null;
}) {
  const [state, action] = useActionState(runPromotion, null);
  const [confirm, setConfirm] = useState("");

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Run promotion</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Every active student moves to the next class in the new session. Students marked
        <em> retain</em> repeat their class, students in the highest class graduate, and
        anyone marked <em>hold</em> is left out.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="From session">
          <select className="select" name="from_session_id" defaultValue={defaultFrom ?? ""} required>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="To session">
          <select className="select" name="to_session_id" defaultValue={defaultTo ?? ""} required>
            <option value="">Select the new session</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Centre" hint="Leave as all centres to promote everyone at once">
          <select className="select" name="center_id" defaultValue="">
            <option value="">All centres</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <label className="mb-4 flex items-start gap-2.5">
          <input type="checkbox" name="make_current" className="mt-0.5 h-4 w-4" defaultChecked />
          <span className="text-[13px]">
            Make the new session current and lock the old one
          </span>
        </label>
        <Field label="Type PROMOTE to confirm">
          <input className="input" name="confirm" value={confirm} autoComplete="off"
            onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder="PROMOTE" />
        </Field>
        <Submit>Run promotion</Submit>
      </form>
    </Card>
  );
}
