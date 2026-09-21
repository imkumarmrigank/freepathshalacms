"use client";
import { useActionState, useState } from "react";
import { reactivateStudent } from "./actions";
import { today } from "@/lib/format";

/** "Bring back" on a row, opening into centre, class and date. */
export default function Reactivate({
  studentId, name, centerId, classId, centres, classes,
}: {
  studentId: number; name: string; centerId: number; classId: number | null;
  centres: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reactivateStudent, null);

  if (state?.ok) return <span className="text-[12.5px] font-medium text-[var(--ok)]">{state.ok}</span>;
  if (!open)
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Bring back
      </button>
    );

  return (
    <form action={action} className="grid min-w-[260px] gap-1.5">
      <input type="hidden" name="student_id" value={studentId} />
      <select className="select py-1 text-[12.5px]" name="center_id" defaultValue={centerId}
        aria-label={`Centre for ${name}`}>
        {centres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
      </select>
      <select className="select py-1 text-[12.5px]" name="class_id" defaultValue={classId ?? ""}
        aria-label={`Class for ${name}`} required>
        <option value="">Class</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input className="input py-1 text-[12.5px]" type="date" name="reactivated_on"
        defaultValue={today()} max={today()} aria-label="Date back" />
      <input className="input py-1 text-[12.5px]" name="note" placeholder="Note (optional)" />
      <div className="flex items-center gap-2">
        <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Make active"}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {state?.error && <span className="text-[12px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}
