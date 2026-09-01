"use client";
import { useActionState } from "react";
import { saveClass } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function ClassForm({
  cls, nextSequence,
}: {
  cls?: { id: number; name: string; sequence: number; is_terminal: boolean; is_active: boolean } | null;
  nextSequence: number;
}) {
  const [state, action] = useActionState(saveClass, null);
  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">{cls ? "Edit class" : "Add class"}</h2>
      <form action={action}>
        {cls && <input type="hidden" name="id" value={cls.id} />}
        <FormMessage state={state} />
        <Field label="Class name *"><input className="input" name="name" defaultValue={cls?.name ?? ""} required /></Field>
        <Field label="Order *" hint="Lower numbers are promoted into higher ones">
          <input className="input" type="number" name="sequence" min={1}
            defaultValue={cls?.sequence ?? nextSequence} required />
        </Field>
        <label className="mb-3 flex items-start gap-2.5">
          <input type="checkbox" name="is_terminal" className="mt-0.5 h-4 w-4" defaultChecked={cls?.is_terminal} />
          <span className="text-[13px]">
            Final class — students here graduate out of the programme instead of moving up
          </span>
        </label>
        {cls && (
          <label className="mb-4 flex items-center gap-2.5">
            <input type="checkbox" name="is_active" className="h-4 w-4" defaultChecked={cls.is_active} />
            <span className="text-[13px]">Class is active</span>
          </label>
        )}
        <Submit>{cls ? "Save class" : "Add class"}</Submit>
      </form>
    </Card>
  );
}
