"use client";
import { useActionState } from "react";
import { applyForLeave, withdrawLeave } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { LEAVE_TYPES } from "@/lib/leave-meta";
import { today } from "@/lib/format";

export function LeaveForm() {
  const [state, action] = useActionState(applyForLeave, null);

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Apply for leave</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        The office approves or refuses it. Until then your register is untouched.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Kind of leave *">
          <select className="select" name="leave_type" required defaultValue="">
            <option value="">Select</option>
            {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="From *">
            <input className="input" type="date" name="starts_on" defaultValue={today()} required />
          </Field>
          <Field label="Until" hint="Leave blank for a single day">
            <input className="input" type="date" name="ends_on" />
          </Field>
        </div>
        <label className="mb-4 flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="half_day" className="h-4 w-4" />
          Half day only
        </label>
        <Field label="Reason *" hint="Seen by the administrator who answers it">
          <textarea className="input" name="reason" rows={3} required
            placeholder="Fever since yesterday, seeing the doctor in the morning." />
        </Field>
        <Submit>Send request</Submit>
      </form>
    </Card>
  );
}

export function WithdrawLeave({ id }: { id: number }) {
  const [state, action] = useActionState(withdrawLeave, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.error ?? "Withdraw"}>
        Withdraw
      </button>
    </form>
  );
}
