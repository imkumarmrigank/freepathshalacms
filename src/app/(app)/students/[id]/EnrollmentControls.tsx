"use client";
import { useActionState } from "react";
import { changeClass, setPromotionDecision } from "../actions";
import { FormMessage } from "@/components/form";

export default function EnrollmentControls({
  enrollmentId, classLevelId, decision, classes,
}: {
  enrollmentId: number; classLevelId: number; decision: string;
  classes: { id: number; name: string }[];
}) {
  const [moveState, moveAction] = useActionState(changeClass, null);
  const [decState, decAction] = useActionState(setPromotionDecision, null);

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      <FormMessage state={moveState ?? decState} />
      <form action={moveAction} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Move to class</span>
          <select className="select" name="class_level_id" defaultValue={classLevelId}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <input type="hidden" name="enrollment_id" value={enrollmentId} />
        <button className="btn btn-ghost btn-sm mb-[1px] h-[38px]" type="submit">Move</button>
      </form>

      <form action={decAction} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">At end of session</span>
          <select className="select" name="promotion_decision" defaultValue={decision}>
            <option value="promote">Promote to next class</option>
            <option value="retain">Retain in same class</option>
            <option value="hold">Hold — decide later</option>
          </select>
        </label>
        <input type="hidden" name="enrollment_id" value={enrollmentId} />
        <button className="btn btn-ghost btn-sm mb-[1px] h-[38px]" type="submit">Set</button>
      </form>
    </div>
  );
}
