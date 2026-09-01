"use client";
import { useActionState } from "react";
import { addTopic } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function AddTopic({ planId }: { planId: number }) {
  const [state, action] = useActionState(addTopic, null);
  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Add a topic</h2>
      <form action={action}>
        <input type="hidden" name="plan_id" value={planId} />
        <FormMessage state={state} />
        <Field label="Topic *">
          <input className="input" name="topic" required placeholder="Fractions — addition and subtraction" />
        </Field>
        <Field label="What the students should take away">
          <textarea className="textarea" name="objective" rows={2} />
        </Field>
        <Field label="Planned for"><input className="input" type="date" name="planned_date" /></Field>
        <Submit>Add topic</Submit>
      </form>
    </Card>
  );
}
