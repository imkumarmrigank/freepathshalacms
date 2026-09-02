"use client";
import { useActionState, useState } from "react";
import { createExam } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { EXAM_TYPES } from "@/lib/exam-meta";

const COMMON_SUBJECTS = [
  "English", "Hindi", "Mathematics", "Science", "Social Science",
  "Computer", "Drawing", "General Knowledge",
];

type Row = { subject: string; max: string; pass: string };
const blank = (): Row => ({ subject: "", max: "", pass: "" });

export default function NewExamForm({
  classes, centers, isAdmin, isTeacher,
}: {
  classes: { id: number; name: string }[];
  centers: { id: number; code: string; name: string }[];
  isAdmin: boolean;
  isTeacher: boolean;
}) {
  const [state, action] = useActionState(createExam, null);
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addSuggested = (name: string) => {
    setRows((rs) => {
      if (rs.some((r) => r.subject.toLowerCase() === name.toLowerCase())) return rs;
      const empty = rs.findIndex((r) => r.subject.trim() === "");
      if (empty >= 0) return rs.map((r, j) => (j === empty ? { ...r, subject: name } : r));
      return [...rs, { ...blank(), subject: name }];
    });
  };

  const filled = rows.filter((r) => r.subject.trim() !== "").length;

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
      <h2 className="mb-1 text-[15px] font-semibold">Set up a test</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        One test, every subject. Each subject gets its own marks sheet, and they appear
        together on the progress report.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Test name *" hint="For example September Monthly Test">
          <input className="input" name="title" required placeholder="September Monthly Test" />
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
          <Field label="Maximum marks *" hint="Applied to every subject">
            <input className="input" type="number" name="max_marks" min={1} step="0.5"
              defaultValue={100} required />
          </Field>
          <Field label="Pass marks">
            <input className="input" type="number" name="pass_marks" min={0} step="0.5"
              defaultValue={33} />
          </Field>
        </div>

        <div className="mb-2 mt-1 flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-[var(--muted)]">
            Subjects * {filled > 0 && <span className="text-[var(--faint)]">({filled})</span>}
          </span>
          <button type="button" className="text-[12px] text-[var(--brand)] hover:underline"
            onClick={() => setRows((rs) => [...rs, blank()])}>
            + add another
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          {COMMON_SUBJECTS.map((sname) => (
            <button key={sname} type="button" onClick={() => addSuggested(sname)}
              className="rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[12px] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">
              {sname}
            </button>
          ))}
        </div>

        <div className="mb-4 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="input flex-1" name="subject_name" value={r.subject}
                placeholder={`Subject ${i + 1}`}
                onChange={(e) => update(i, { subject: e.target.value })} />
              <input className="input w-20 text-right" name="subject_max" value={r.max}
                inputMode="decimal" placeholder="max"
                title="Leave blank to use the maximum above"
                onChange={(e) => update(i, { max: e.target.value })} />
              <input className="input w-20 text-right" name="subject_pass" value={r.pass}
                inputMode="decimal" placeholder="pass"
                title="Leave blank to use the pass mark above"
                onChange={(e) => update(i, { pass: e.target.value })} />
              <button type="button" aria-label="Remove subject"
                className="px-1 text-[var(--faint)] hover:text-[var(--bad)]"
                onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}>
                ×
              </button>
            </div>
          ))}
          <p className="text-[12px] text-[var(--faint)]">
            Leave max and pass blank to use the values above. Empty rows are ignored.
          </p>
        </div>

        <Field label="Term label" hint="Groups the subjects on the report — defaults to the test name">
          <input className="input" name="term_label" placeholder="Term 1" />
        </Field>
        <Submit>Create test</Submit>
      </form>
    </Card>
  );
}
