"use client";
import { useActionState } from "react";
import { today } from "@/lib/format";
import { createMonthlyExams } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { MONTHS, MONTHLY_TEMPLATE_CLASSES } from "@/lib/exam-meta";

export default function MonthlyExamForm({
  centerCount,
}: {
  centerCount: number;
}) {
  const [state, action] = useActionState(createMonthlyExams, null);

  // 5 classes × 7 subjects × all centres
  const totalSheets = 5 * 7 * centerCount;

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Create monthly exams</h2>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        Creates the standard paper pattern for{" "}
        <span className="font-medium">
          {MONTHLY_TEMPLATE_CLASSES.join(", ")}
        </span>{" "}
        across all {centerCount} active centre{centerCount === 1 ? "" : "s"}.
      </p>

      <div className="mb-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--faint)]">
          Paper pattern
        </p>
        <div className="space-y-1.5 text-[12px]">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--muted)]">Nursery &amp; KG</span>
            <span className="tabular-nums text-[var(--text)]">
              English 20 · Hindi 20 · Maths 20 · EVE 10 · GK 10 · Poem 10 · Drawing 10
              <span className="ml-2 font-semibold">= 100</span>
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--muted)]">Class 1 – 3</span>
            <span className="tabular-nums text-[var(--text)]">
              English 30 · Hindi 30 · Maths 30 · EVE 20 · GK 20 · Poem 10 · Drawing 10
              <span className="ml-2 font-semibold">= 150</span>
            </span>
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
            5 classes × 7 subjects × {centerCount} centre{centerCount === 1 ? "" : "s"}.
          </p>
        )}
        <Submit>Create monthly exams</Submit>
      </form>
    </Card>
  );
}
