"use client";
import { useActionState } from "react";
import { setAllocation } from "@/app/(app)/teaching-plans/actions";
import { Avatar } from "@/components/ui";

export default function AllocationRow({
  teacher, classes, allotted,
}: {
  teacher: { id: number; name: string; email: string; center_name: string | null };
  classes: { id: number; name: string }[];
  allotted: number[];
}) {
  const [state, action] = useActionState(setAllocation, null);
  return (
    <form action={action} className="border-t border-[#f1f1f6] px-5 py-4 first:border-t-0">
      <input type="hidden" name="user_id" value={teacher.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={teacher.name} size={32} />
          <div>
            <div className="text-[14px] font-medium">{teacher.name}</div>
            <div className="text-[12px] text-[var(--muted)]">
              {teacher.center_name ?? "No centre"} · {teacher.email}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state && (
            <span className={`text-[12px] ${state.error ? "text-[var(--bad)]" : "text-[var(--ok)]"}`}>
              {state.error ?? state.ok}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" type="submit">Save</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {classes.map((c) => (
          <label key={c.id} className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" name="class_level_id" value={c.id} className="h-4 w-4"
              defaultChecked={allotted.includes(c.id)} />
            {c.name}
          </label>
        ))}
      </div>
    </form>
  );
}
