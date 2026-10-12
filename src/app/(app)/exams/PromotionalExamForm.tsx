"use client";
import { useActionState } from "react";
import { today } from "@/lib/format";
import { createPromotionalExams } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { MONTHS, PROMOTIONAL_TEMPLATE_CLASSES } from "@/lib/exam-meta";

export default function PromotionalExamForm({
  centerCount,
}: {
  centerCount: number;
}) {
  const [state, action] = useActionState(createPromotionalExams, null);

  // 6 classes × 10 papers × all centres
  const totalSheets = 6 * 10 * centerCount;

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Create promotional exams</h2>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        Creates the standard final exam pattern for{" "}
        <span className="font-medium">
          {PROMOTIONAL_TEMPLATE_CLASSES.join(", ")}
        </span>{" "}
        across all {centerCount} active centre{centerCount === 1 ? "" : "s"}.
      </p>

      <div className="mb-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--faint)]">
          Paper pattern
        </p>
        <div className="space-y-2.5 text-[12px]">
          <div>
            <span className="font-medium text-[var(--text)]">Nursery &amp; KG</span>
            <span className="ml-2 font-semibold text-[var(--brand)]">= 190</span>
            <div className="mt-1 text-[var(--muted)]">
              Hindi W&nbsp;40 + O&nbsp;10 · English W&nbsp;40 + O&nbsp;10 · Maths W&nbsp;40 + O&nbsp;10
              · EVS&nbsp;10 · GK&nbsp;10 · Drawing&nbsp;10 · Poem&nbsp;10
            </div>
          </div>
          <div>
            <span className="font-medium text-[var(--text)]">Class 1 – 4</span>
            <span className="ml-2 font-semibold text-[var(--brand)]">= 260</span>
            <div className="mt-1 text-[var(--muted)]">
              Hindi W&nbsp;50 + O&nbsp;10 · English W&nbsp;50 + O&nbsp;10 · Maths W&nbsp;50 + O&nbsp;10
              · EVS&nbsp;20 · GK&nbsp;20 · Drawing&nbsp;20 · Poem&nbsp;20
            </div>
          </div>
        </div>
      </div>

      <form action={action}>
        <FormMessage state={state} />
        <Field label="Month *">
          <select className="select" name="title" required defaultValue="">
            <option value="" disabled>Choose a month</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Date of exam *">
          <input className="input" type="date" name="exam_date" required
            defaultValue={today()} />
        </Field>
        {centerCount > 0 && (
          <p className="mb-3 rounded-[9px] bg-[var(--brand-soft)] px-3 py-2 text-[12px] text-[var(--brand)]">
            This will create <strong>{totalSheets}</strong> marks sheets —
            6 classes × 10 papers × {centerCount} centre{centerCount === 1 ? "" : "s"}.
          </p>
        )}
        <Submit>Create promotional exams</Submit>
      </form>
    </Card>
  );
}
