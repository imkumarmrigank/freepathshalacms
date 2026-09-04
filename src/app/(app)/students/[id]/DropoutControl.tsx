"use client";
import { useActionState, useState } from "react";
import { markDropout, reinstateStudent } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { fmtDate, today } from "@/lib/format";

/** Reasons the centres actually give, so the report groups instead of guessing. */
const REASONS = [
  "Family moved away",
  "Went back to the village",
  "Admitted to a government school",
  "Admitted to another school",
  "Started working",
  "Long illness",
  "Too young to continue",
  "Parents withdrew the child",
  "Stopped attending, reason unknown",
] as const;

export default function DropoutControl({
  studentId, status, reason, on,
}: {
  studentId: number;
  status: string;
  reason: string | null;
  on: string | null;
}) {
  const [markState, mark] = useActionState(markDropout, null);
  const [backState, back] = useActionState(reinstateStudent, null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(REASONS[0]);

  if (status === "dropped") {
    return (
      <Card>
        <h2 className="mb-1 text-[15px] font-semibold text-[var(--bad)]">Dropped out</h2>
        <p className="mb-3 text-[13px] text-[var(--muted)]">
          {reason ?? "No reason recorded"}
          {on ? ` · ${fmtDate(on)}` : ""}
        </p>
        <form action={back}>
          <FormMessage state={backState} />
          <input type="hidden" name="id" value={studentId} />
          <Submit>The child came back</Submit>
        </form>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">Drop out</h2>
            <p className="text-[13px] text-[var(--muted)]">
              Takes the child off the roll and closes their enrolment.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Mark
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 text-[15px] font-semibold">Mark as dropped out</h2>
      <form action={mark}>
        <FormMessage state={markState} />
        <input type="hidden" name="id" value={studentId} />
        <Field label="Reason *">
          <select className="select" value={picked} onChange={(e) => setPicked(e.target.value)}
            name={picked === "Other" ? undefined : "dropout_reason"}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value="Other">Other — type it below</option>
          </select>
        </Field>
        {picked === "Other" && (
          <Field label="What happened *">
            <textarea className="textarea" name="dropout_reason" rows={2} required
              placeholder="In the centre's own words" />
          </Field>
        )}
        <Field label="Date">
          <input className="input" type="date" name="dropout_date"
            defaultValue={today()} />
        </Field>
        <div className="flex items-center gap-2">
          <Submit>Mark dropped out</Submit>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
