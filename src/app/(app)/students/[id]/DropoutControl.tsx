"use client";
import { useActionState, useState } from "react";
import { markDropout, reinstateStudent } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { fmtDate, today } from "@/lib/format";
import { DROPOUT_REASONS } from "@/lib/dropout-meta";

export default function DropoutControl({
  studentId, status, reason, on, remarks, markedBy, markedAt,
}: {
  studentId: number;
  status: string;
  reason: string | null;
  on: string | null;
  remarks?: string | null;
  markedBy?: string | null;
  markedAt?: string | null;
}) {
  const [markState, mark] = useActionState(markDropout, null);
  const [backState, back] = useActionState(reinstateStudent, null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(DROPOUT_REASONS[0]);

  if (status === "dropped") {
    return (
      <Card>
        <h2 className="mb-1 text-[15px] font-semibold text-[var(--bad)]">Dropped out</h2>
        <p className="text-[13px] font-medium">
          {reason ?? "No reason recorded"}
          {on ? <span className="font-normal text-[var(--muted)]"> · {fmtDate(on)}</span> : null}
        </p>
        {remarks && <p className="mt-1 text-[13px] text-[var(--muted)]">{remarks}</p>}
        {markedBy && (
          <p className="mt-1 text-[12px] text-[var(--faint)]">
            Marked by {markedBy}{markedAt ? ` on ${fmtDate(markedAt)}` : ""}
          </p>
        )}
        <div className="mb-3" />
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
          {/* the reason is always one of the listed ones, so the report can
              group by it; anything particular to this child goes in remarks */}
          <select className="select" name="dropout_reason" value={picked}
            onChange={(e) => setPicked(e.target.value)}>
            {DROPOUT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label={picked === "Other" ? "What happened *" : "Remarks"}
          hint={picked === "Other"
            ? "Other on its own tells the mentor nothing — say what happened."
            : "Anything the mentor should know if they follow this child up."}>
          <textarea className="textarea" name="dropout_remarks" rows={2}
            required={picked === "Other"}
            placeholder="In the centre's own words" />
        </Field>
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
