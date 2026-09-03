"use client";
import { useActionState } from "react";
import { addTopic } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";

export default function AddTopic({ planId, hindi = false }:
  { planId: number; hindi?: boolean }) {
  const [state, action] = useActionState(addTopic, null);
  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Add a topic</h2>
      <form action={action}>
        <input type="hidden" name="plan_id" value={planId} />
        <FormMessage state={state} />
        <Field label="Topic *">
          <HindiInput name="topic" required startInHindi={hindi}
            placeholder={hindi ? "स्वर और व्यंजन की पहचान"
                               : "Fractions — addition and subtraction"} />
        </Field>
        <Field label="What the students should take away">
          <HindiInput name="objective" rows={2} className="textarea" startInHindi={hindi} />
        </Field>
        <Field label="Planned for"><input className="input" type="date" name="planned_date" /></Field>
        <Submit>Add topic</Submit>
      </form>
    </Card>
  );
}
