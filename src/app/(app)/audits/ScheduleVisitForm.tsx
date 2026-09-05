"use client";
import { useActionState, useState } from "react";
import { scheduleVisit } from "./actions";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { VISIT_KINDS, VISIT_KIND_BLURB, VISIT_KIND_LABEL } from "@/lib/audit-meta";

/**
 * Booking a visit. Tucked behind a button because it is an occasional act —
 * the page is mostly read, not written.
 */
export default function ScheduleVisitForm({ centres, auditors }: {
  centres: { id: number; name: string; code: string }[];
  auditors: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("scheduled");
  const [state, action] = useActionState(scheduleVisit, null);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Schedule a visit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onClick={() => setOpen(false)}>
      <div className="card card-pad w-full max-w-[540px] bg-white"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-[16px] font-semibold">Schedule a visit</h2>
        <form action={action}>
          <FormMessage state={state} />

          {auditors.length === 0 && (
            <p className="mb-3 rounded-[9px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px]">
              There are no auditors yet. Add one under Staff first — give them the
              Auditor role.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Centre *">
              <select className="select" name="center_id" required defaultValue="">
                <option value="" disabled>Choose a centre</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Auditor *">
              <select className="select" name="auditor_id" required defaultValue="">
                <option value="" disabled>Choose an auditor</option>
                {auditors.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Date *">
              <input className="input" type="date" name="scheduled_for" required />
            </Field>
            <Field label="Kind of visit *">
              <select className="select" name="kind" value={kind}
                onChange={(e) => setKind(e.target.value)}>
                {VISIT_KINDS.map((k) => (
                  <option key={k} value={k}>{VISIT_KIND_LABEL[k]}</option>
                ))}
              </select>
            </Field>
          </div>

          <p className="mt-2 text-[12.5px] text-[var(--muted)]">
            {VISIT_KIND_BLURB[kind as keyof typeof VISIT_KIND_BLURB]}
          </p>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <Submit>Schedule</Submit>
          </div>
        </form>
      </div>
    </div>
  );
}
