"use client";
import { useActionState, useState } from "react";
import { updateExam } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { EXAM_TYPES } from "@/lib/exam-meta";

export type ExamForEdit = {
  id: number; title: string; subject: string; exam_type: string; exam_date: string;
  max_marks: string; pass_marks: string | null; term_label: string | null;
  class_name: string; center_name: string;
};

/**
 * Correcting a test after it has been scheduled. Class and centre are shown but
 * fixed — moving a paper to another roster would strand the marks already on it.
 */
export default function EditExam({ exam, siblings }:
  { exam: ExamForEdit; siblings: number }) {
  const [state, action] = useActionState(updateExam, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Schedule</h2>
            <p className="text-[13px] text-[var(--muted)]">
              {exam.class_name} · {exam.center_name} — class and centre are fixed once
              a test exists.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Edit test
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Edit test</h2>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="exam_id" value={exam.id} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Test name *">
            <input className="input" name="title" defaultValue={exam.title} required />
          </Field>
          <Field label="Subject *">
            <input className="input" name="subject" defaultValue={exam.subject} required />
          </Field>
          <Field label="Type *">
            <select className="select" name="exam_type" defaultValue={exam.exam_type}>
              {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Date of test *">
            <input className="input" type="date" name="exam_date" required
              defaultValue={String(exam.exam_date).slice(0, 10)} />
          </Field>
          <Field label="Maximum marks *">
            <input className="input" type="number" name="max_marks" min={1} step="0.5"
              defaultValue={Number(exam.max_marks)} required />
          </Field>
          <Field label="Pass marks">
            <input className="input" type="number" name="pass_marks" min={0} step="0.5"
              defaultValue={exam.pass_marks === null ? "" : Number(exam.pass_marks)} />
          </Field>
          <Field label="Term label" wide
            hint="Groups the subjects together on the progress report">
            <input className="input" name="term_label" defaultValue={exam.term_label ?? ""} />
          </Field>
        </div>

        {siblings > 0 && (
          <label className="mb-3 flex items-start gap-2.5 text-[13px]">
            <input type="checkbox" name="apply_to_all" className="mt-0.5" defaultChecked />
            <span>
              Apply the name, type and date to the other {siblings} subject
              {siblings === 1 ? "" : "s"} of this test.
              <span className="block text-[12px] text-[var(--muted)]">
                Their own subject names, maximum and pass marks are left alone.
              </span>
            </span>
          </label>
        )}

        <div className="flex items-center gap-2">
          <Submit>Save changes</Submit>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
