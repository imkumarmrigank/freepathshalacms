"use client";
import { useActionState } from "react";
import { overrideStaffAttendance } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

export default function OverrideForm({
  staff, date,
}: { staff: { id: number; name: string }[]; date: string }) {
  const [state, action] = useActionState(overrideStaffAttendance, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Manual entry</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Use this when someone was at the centre but could not check in — a dead phone,
        no GPS signal, or approved off-site work. The entry is stamped with your name.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Staff member">
          <select className="select" name="user_id" required defaultValue="">
            <option value="">Select</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input className="input" type="date" name="att_date" defaultValue={date} required /></Field>
        <Field label="Mark as">
          <select className="select" name="status" defaultValue="present">
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="leave">On leave</option>
            <option value="holiday">Holiday</option>
          </select>
        </Field>
        <Field label="Reason *">
          <textarea className="textarea" name="override_reason" rows={2} required
            placeholder="Why is this being entered manually?" />
        </Field>
        <Submit>Save entry</Submit>
      </form>
    </Card>
  );
}
