"use client";
import { useActionState } from "react";
import { updateStudent } from "../actions";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

import type { Student } from "@/lib/types";

export default function EditStudent({ s, readOnly }: { s: Student; readOnly: boolean }) {
  const [state, action] = useActionState(updateStudent, null);
  const d = (v: string | null) => v ?? "";

  return (
    <form action={action}>
      <input type="hidden" name="id" value={s.id} />
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="contents">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="First name"><input className="input" name="first_name" defaultValue={s.first_name} required /></Field>
          <Field label="Last name"><input className="input" name="last_name" defaultValue={d(s.last_name)} /></Field>
          <Field label="Gender">
            <select className="select" name="gender" defaultValue={d(s.gender)}>
              <option value="">Select</option><option value="male">Male</option>
              <option value="female">Female</option><option value="other">Other</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input className="input" type="date" name="dob" defaultValue={s.dob ? String(s.dob).slice(0, 10) : ""} />
          </Field>
          <Field label="Father's name"><input className="input" name="father_name" defaultValue={d(s.father_name)} /></Field>
          <Field label="Mother's name"><input className="input" name="mother_name" defaultValue={d(s.mother_name)} /></Field>
          <Field label="Guardian's name"><input className="input" name="guardian_name" defaultValue={d(s.guardian_name)} /></Field>
          <Field label="Primary phone"><input className="input" name="primary_phone" defaultValue={d(s.primary_phone)} /></Field>
          <Field label="Alternate phone"><input className="input" name="alt_phone" defaultValue={d(s.alt_phone)} /></Field>
          <Field label="Email"><input className="input" type="email" name="email" defaultValue={d(s.email)} /></Field>
          <Field label="Status">
            <select className="select" name="status" defaultValue={s.status}>
              {["active","inactive","graduated","transferred","dropped"].map((v) => (
                <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Address" wide><textarea className="textarea" name="address" rows={2} defaultValue={d(s.address)} /></Field>
          <Field label="Notes" wide><textarea className="textarea" name="notes" rows={2} defaultValue={d(s.notes)} /></Field>
        </div>
        {!readOnly && <Submit>Save changes</Submit>}
      </fieldset>
    </form>
  );
}
