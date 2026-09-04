"use client";
import { useActionState } from "react";
import { toISODate } from "@/lib/format";
import { submitPlan } from "../actions";
import { FormMessage, Submit } from "@/components/form";

export default function SubmitPlan({
  planId, topics, startsOn, leadDays,
}: { planId: number; topics: number; startsOn: string | null; leadDays: number }) {
  const [state, action] = useActionState(submitPlan, null);
  const earliest = new Date();
  earliest.setDate(earliest.getDate() + leadDays);
  const tooLate = !startsOn || startsOn < toISODate(earliest);

  return (
    <div className="card card-pad">
      <h2 className="mb-1 text-[15px] font-semibold">Not submitted yet</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        A plan has to reach your centre manager at least {leadDays} days before it starts.
        Once submitted, the manager and the administrator can read it.
      </p>
      <form action={action}>
        <input type="hidden" name="plan_id" value={planId} />
        <FormMessage state={state} />
        {topics === 0 && (
          <p className="mb-3 rounded-[9px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px] text-[#b45309]">
            Add at least one topic before you submit.
          </p>
        )}
        {tooLate && topics > 0 && (
          <p className="mb-3 rounded-[9px] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[13px] text-[#b91c1c]">
            This plan starts in less than {leadDays} days, so it can no longer be submitted on time.
          </p>
        )}
        <Submit>Submit to centre manager</Submit>
      </form>
    </div>
  );
}
