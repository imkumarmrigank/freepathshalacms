"use client";
import { useActionState, useState } from "react";
import { raiseFlag } from "../../counselling/actions";
import { Badge, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { fmtDate } from "@/lib/format";
import {
  FLAG_REASONS, FLAG_STATUS_LABEL, FLAG_STATUS_TONE,
} from "@/lib/counselling-meta";

export type OpenFlag = {
  id: number; status: string; urgency: string; reasons: string[];
  note: string | null; raised_on: string; raised_by_name: string | null;
};

/**
 * A teacher's referral to the mentor. Reasons come from a list — that is what
 * turns a hundred worried notes into something a mentor can prioritise.
 */
export default function FlagForCounselling({ studentId, flag, canRaise, startOpen = false }:
  { studentId: number; flag: OpenFlag | null; canRaise: boolean; startOpen?: boolean }) {
  const [state, action] = useActionState(raiseFlag, null);
  const [open, setOpen] = useState(startOpen);

  if (flag) {
    return (
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold">Counselling</h2>
          <Badge tone={FLAG_STATUS_TONE[flag.status]}>
            {FLAG_STATUS_LABEL[flag.status] ?? flag.status}
          </Badge>
          {flag.urgency === "high" && <Badge tone="bad">Urgent</Badge>}
        </div>
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {flag.reasons.map((r) => (
            <li key={r} className="rounded-full bg-[#f4f4f9] px-2.5 py-1 text-[12px] text-[var(--muted)]">
              {r}
            </li>
          ))}
        </ul>
        {flag.note && <p className="mb-2 text-[13px]">{flag.note}</p>}
        <p className="text-[12px] text-[var(--muted)]">
          Raised {fmtDate(flag.raised_on)}
          {flag.raised_by_name ? ` by ${flag.raised_by_name}` : ""}
        </p>
      </Card>
    );
  }

  if (!canRaise) {
    return (
      <Card>
        <h2 className="text-[15px] font-semibold">Counselling</h2>
        <p className="text-[13px] text-[var(--muted)]">
          No referral open for this child. A teacher raises one from here.
        </p>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">Counselling</h2>
            <p className="text-[13px] text-[var(--muted)]">
              Ask the mentor to sit with this child.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Flag
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Flag for counselling</h2>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        The mentor sees this on their list straight away.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="student_id" value={studentId} />
        <fieldset className="mb-3">
          <legend className="mb-1.5 text-[13px] font-medium">What has been noticed? *</legend>
          <div className="space-y-1.5">
            {FLAG_REASONS.map((r) => (
              <label key={r} className="flex items-start gap-2.5 text-[13px]">
                <input type="checkbox" name="reason" value={r} className="mt-0.5" />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Anything else the mentor should know">
          <textarea className="textarea" name="note" rows={3}
            placeholder="What you have seen, and what you have already tried" />
        </Field>
        <Field label="Urgency">
          <select className="select" name="urgency" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="high">Urgent — see this child first</option>
          </select>
        </Field>
        <div className="flex items-center gap-2">
          <Submit>Send to mentor</Submit>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
