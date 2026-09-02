"use client";
import { useActionState } from "react";
import { createExam } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { EXAM_TYPES } from "@/lib/exam-meta";

export default function NewExamForm({
  classes, centers, isAdmin, isTeacher,
}: {
  classes: { id: number; name: string }[];
  centers: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  isTeacher: boolean;
}) {
  const [state, action] = useActionState(createExam, null);

  if (isTeacher && classes.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-[15px] font-semibold">New test</h2>
        <p className="text-[13px] text-[var(--muted)]">
          You are not allotted to any class this session, so there is nothing to set a test for.
          Your centre manager assigns classes under Administration → Class allocation.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Set up a test</h2>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Title *">
          <input className="input" name="title" required placeholder="September monthly test" />
        </Field>
        <Field label="Subject *">
          <input className="input" name="subject" required placeholder="Mathematics" />
        </Field>
        <Field label="Type *">
          <select className="select" name="exam_type" defaultValue="monthly">
            {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {isAdmin && (
          <Field label="Centre *">
            <select className="select" name="center_id" required defaultValue="">
              <option value="">Select centre</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Class *" hint={isTeacher ? "Only classes you are allotted" : undefined}>
          <select className="select" name="class_level_id" required defaultValue="">
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date of test *">
          <input className="input" type="date" name="exam_date" required
            defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Maximum marks *">
            <input className="input" type="number" name="max_marks" min={1} step="0.5"
              defaultValue={100} required />
          </Field>
          <Field label="Pass marks">
            <input className="input" type="number" name="pass_marks" min={0} step="0.5"
              defaultValue={33} />
          </Field>
        </div>
        <Field label="Term label" hint="Optional — e.g. September, Term 1">
          <input className="input" name="term_label" />
        </Field>
        <Submit>Create test</Submit>
      </form>
    </Card>
  );
}
