"use client";
import { useActionState } from "react";
import { assignManager } from "../actions";
import { FormMessage } from "@/components/form";

export default function ManagerPicker({
  centerId, managerId, candidates,
}: {
  centerId: number; managerId: number | null;
  candidates: { id: number; name: string; email: string }[];
}) {
  const [state, action] = useActionState(assignManager, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="center_id" value={centerId} />
      <select className="select w-auto min-w-[180px]" name="manager_id" defaultValue={managerId ?? ""}>
        <option value="">No manager</option>
        {candidates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <button className="btn btn-ghost btn-sm" type="submit">Assign</button>
      <span className="text-[12px]">{state?.error ?? state?.ok ?? ""}</span>
      <span className="sr-only"><FormMessage state={state} /></span>
    </form>
  );
}
