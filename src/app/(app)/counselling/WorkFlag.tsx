"use client";
import { useActionState, useState } from "react";
import { updateFlag } from "./actions";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

/**
 * The mentor's side of a referral: pick it up, write down each thing done
 * about it, then say how it ended. Every save is dated, so the register
 * reads as a trail rather than a single verdict at the end.
 */
export default function WorkFlag({ flagId, status, outcome }:
  { flagId: number; status: string; outcome: string | null }) {
  const [state, action] = useActionState(updateFlag, null);
  // Recording a step is the everyday choice and closing is the deliberate
  // one, so the box opens on the step even for a referral already in hand.
  const [next, setNext] = useState("in_progress");

  if (status === "closed") return null;
  const working = status === "in_progress";

  return (
    <form action={action} className="mt-2.5 border-t border-[#f1f1f6] pt-2.5">
      <FormMessage state={state} />
      <input type="hidden" name="flag_id" value={flagId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px]">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Move to</span>
          <select className="select w-auto" name="status" value={next}
            onChange={(e) => setNext(e.target.value)}>
            <option value="in_progress">
              {working ? "Record what you did" : "Counselling under way"}
            </option>
            <option value="closed">Close the referral</option>
          </select>
        </label>
        {next === "closed" ? (
          <div className="min-w-[260px] flex-1">
            <Field label="What came of it *">
              <input className="input" name="outcome" required
                defaultValue={outcome ?? ""}
                placeholder="Spoke to the mother; child is back from the village" />
            </Field>
          </div>
        ) : (
          <div className="min-w-[260px] flex-1">
            <Field label={working ? "What you did today *" : "What you did today"}
              hint="Dated and kept against the child">
              <input className="input" name="note" required={working}
                placeholder="Went to the house; the mother will come on Saturday" />
            </Field>
          </div>
        )}
        <div className="mb-[1px]"><Submit>Save</Submit></div>
      </div>
    </form>
  );
}
