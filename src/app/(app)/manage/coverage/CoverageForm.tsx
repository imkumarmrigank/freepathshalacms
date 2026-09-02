"use client";
import { useActionState } from "react";
import { assignCoverage, endCoverage } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

type Person = { id: number; name: string; center_name: string | null };

export function CoverageForm({ backups, teachers }: { backups: Person[]; teachers: Person[] }) {
  const [state, action] = useActionState(assignCoverage, null);
  const today = new Date().toISOString().slice(0, 10);

  if (backups.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-[15px] font-semibold">Assign a backup teacher</h2>
        <p className="text-[13px] text-[var(--muted)]">
          No backup teachers yet. Add one under Staff with the Backup Teacher role — they are not
          attached to a centre, because they go wherever they are needed.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Assign a backup teacher</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        While the cover runs, the backup teacher works at that centre and holds the absent
        teacher’s classes.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Backup teacher *">
          <select className="select" name="backup_id" required defaultValue="">
            <option value="">Select</option>
            {backups.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Covering for *" hint="The regular teacher who is away">
          <select className="select" name="covering_id" required defaultValue="">
            <option value="">Select</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.center_name ? ` · ${t.center_name}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="From *">
            <input className="input" type="date" name="starts_on" defaultValue={today} required />
          </Field>
          <Field label="Until" hint="Leave blank if open ended">
            <input className="input" type="date" name="ends_on" />
          </Field>
        </div>
        <Field label="Reason"><input className="input" name="reason" placeholder="Sick leave" /></Field>
        <Submit>Assign cover</Submit>
      </form>
    </Card>
  );
}

export function EndCoverage({ id }: { id: number }) {
  const [state, action] = useActionState(endCoverage, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.error ?? "End today"}>
        End cover
      </button>
    </form>
  );
}
