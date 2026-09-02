"use client";
import { useActionState, useState } from "react";
import { changeClass, promoteNow, setPromotionDecision } from "../actions";
import { FormMessage } from "@/components/form";
import { PTM_RECOMMENDER, RECOMMENDERS } from "@/lib/promotion-meta";

export default function EnrollmentControls({
  enrollmentId, classLevelId, decision, classes, nextClassName, meetings,
}: {
  enrollmentId: number; classLevelId: number; decision: string;
  classes: { id: number; name: string }[];
  /** the class above this one, or null when the child is already at the top */
  nextClassName: string | null;
  /** this child's parent meetings, so a PTM-based promotion can point at one */
  meetings: { id: number; label: string }[];
}) {
  const [moveState, moveAction] = useActionState(changeClass, null);
  const [decState, decAction] = useActionState(setPromotionDecision, null);
  const [upState, upAction] = useActionState(promoteNow, null);
  const [recommender, setRecommender] = useState<string>(RECOMMENDERS[0]);

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      <FormMessage state={moveState ?? decState ?? upState} />

      {nextClassName && (
        <form action={upAction} className="rounded-[10px] bg-[#fafaff] p-3">
          <p className="mb-2 text-[13px]">
            <span className="font-medium">Promote now</span>
            <span className="text-[var(--muted)]">
              {" "}— move this child up to {nextClassName} without waiting for the
              year end.
            </span>
          </p>
          <input type="hidden" name="enrollment_id" value={enrollmentId} />
          <label className="mb-2 block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
              On whose recommendation
            </span>
            <select className="select" name="recommended_by" value={recommender}
              onChange={(e) => setRecommender(e.target.value)}>
              {RECOMMENDERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {recommender === PTM_RECOMMENDER && (
            <label className="mb-2 block">
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
                Which meeting
              </span>
              {meetings.length === 0 ? (
                <span className="block text-[13px] text-[var(--bad)]">
                  No parent meeting has been recorded for this child yet.
                </span>
              ) : (
                <select className="select" name="ptm_interaction_id" defaultValue="">
                  <option value="">Select the meeting</option>
                  {meetings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              )}
            </label>
          )}
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
                Why
              </span>
              <input className="input" name="reason"
                placeholder="Reading well ahead of the class" />
            </label>
            <button className="btn btn-ghost btn-sm mb-[1px] h-[38px]" type="submit">
              Promote
            </button>
          </div>
        </form>
      )}
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
