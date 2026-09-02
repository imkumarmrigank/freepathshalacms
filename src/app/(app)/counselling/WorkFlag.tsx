"use client";
import { useActionState, useState } from "react";
import { updateFlag } from "./actions";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

/** The mentor's side of a referral: pick it up, then say how it ended. */
export default function WorkFlag({ flagId, status, outcome }:
  { flagId: number; status: string; outcome: string | null }) {
  const [state, action] = useActionState(updateFlag, null);
  const [next, setNext] = useState(status === "open" ? "in_progress" : "closed");

  if (status === "closed") return null;

  return (
    <form action={action} className="mt-2.5 border-t border-[#f1f1f6] pt-2.5">
      <FormMessage state={state} />
      <input type="hidden" name="flag_id" value={flagId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px]">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Move to</span>
          <select className="select w-auto" name="status" value={next}
            onChange={(e) => setNext(e.target.value)}>
            <option value="in_progress">Counselling under way</option>
            <option value="closed">Close the referral</option>
          </select>
        </label>
        {next === "closed" && (
          <div className="min-w-[260px] flex-1">
            <Field label="What came of it *">
              <input className="input" name="outcome" required
                defaultValue={outcome ?? ""}
                placeholder="Spoke to the mother; child is back from the village" />
            </Field>
          </div>
        )}
        <div className="mb-[1px]"><Submit>Save</Submit></div>
      </div>
    </form>
  );
}
