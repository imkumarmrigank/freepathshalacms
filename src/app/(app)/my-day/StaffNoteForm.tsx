"use client";
import { useActionState } from "react";
import { saveStaffDayNote } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";
import { NOTE_FIELDS, type StaffNote } from "@/lib/day-note-meta";

/**
 * The day book for a mentor, an auditor or a sports teacher.
 *
 * The questions come from the role, not from this file: each one is declared
 * in day-note-meta and rendered here, in Hindi or English, so adding a
 * question to a role is a line there rather than a form here.
 */
export default function StaffNoteForm({ role, date, note }:
  { role: string; date: string; note?: StaffNote | null }) {
  const [state, action] = useActionState(saveStaffDayNote, null);
  const fields = NOTE_FIELDS[role] ?? [];

  return (
    <Card>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="on_date" value={date} />

        {fields.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint}>
            {f.numeric ? (
              <input className="input" type="number" name={f.name} min={0}
                defaultValue={(note?.[f.name] as number | undefined) ?? ""} />
            ) : (
              <HindiInput name={f.name} rows={f.rows}
                defaultValue={(note?.[f.name] as string | undefined) ?? ""} />
            )}
          </Field>
        ))}

        <Submit>{note ? "Save the day" : "Write up the day"}</Submit>
      </form>
    </Card>
  );
}
