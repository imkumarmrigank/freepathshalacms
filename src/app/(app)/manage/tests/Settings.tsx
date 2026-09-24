"use client";
import { useActionState } from "react";
import { saveTestConfig } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export type Config = {
  for_role: string; duration_minutes: number; question_count: number;
  tests_per_month: number; avoid_last_tests: number; is_open: boolean;
};

/** How long the paper runs, how big it is, and how often — set by the office. */
export default function Settings({ config }: { config: Config }) {
  const [state, action] = useActionState(saveTestConfig, null);
  return (
    <Card>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="for_role" value={config.for_role} />
        <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Minutes for the test" hint="the clock starts when they begin">
            <input className="input" type="number" name="duration_minutes" min={1} max={180}
              defaultValue={config.duration_minutes} />
          </Field>
          <Field label="Questions in a paper">
            <input className="input" type="number" name="question_count" min={1} max={50}
              defaultValue={config.question_count} />
          </Field>
          <Field label="Tests a month" hint="the month is split into this many stretches">
            <input className="input" type="number" name="tests_per_month" min={1} max={12}
              defaultValue={config.tests_per_month} />
          </Field>
          <Field label="Hold questions back for" hint="this many of their recent tests">
            <input className="input" type="number" name="avoid_last_tests" min={0} max={10}
              defaultValue={config.avoid_last_tests} />
          </Field>
        </div>
        <label className="mb-3 flex items-center gap-2.5">
          <input type="checkbox" name="is_open" className="h-4 w-4" defaultChecked={config.is_open} />
          <span className="text-[13px]">Test is open — unticked, nobody can start a new one</span>
        </label>
        <Submit>Save settings</Submit>
      </form>
    </Card>
  );
}
