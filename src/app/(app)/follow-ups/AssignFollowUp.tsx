"use client";
import { useActionState } from "react";
import { assignFollowUp } from "../ptm/actions";

export default function AssignFollowUp({
  id, assigneeId, people,
}: {
  id: number;
  assigneeId: number | null;
  people: { id: number; name: string }[];
}) {
  const [state, action] = useActionState(assignFollowUp, null);
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <select className="select w-auto min-w-[140px] text-[12px]" name="follow_up_assignee_id"
        defaultValue={assigneeId ?? ""}>
        <option value="">Unassigned</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm" type="submit" title={state?.error ?? "Assign"}>
        Set
      </button>
    </form>
  );
}
