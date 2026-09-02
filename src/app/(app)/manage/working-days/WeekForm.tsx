"use client";
import { useActionState } from "react";
import { saveWorkingDays } from "./actions";
import { FormMessage, Submit } from "@/components/form";
import { DAY_NAMES } from "@/lib/week";

export default function WeekForm({ off }: { off: number[] }) {
  const [state, action] = useActionState(saveWorkingDays, null);

  return (
    <form action={action}>
      <FormMessage state={state} />
      <ul className="mb-4 divide-y divide-[#f1f1f6] rounded-[10px] border border-[var(--border)]">
        {DAY_NAMES.map((name, dow) => {
          const isOff = off.includes(dow);
          return (
            <li key={name} className="flex items-center justify-between gap-3 px-4 py-3">
              <label className="flex items-center gap-3 text-[14px]">
                <input type="checkbox" name="working_day" value={dow} defaultChecked={!isOff} />
                <span className="font-medium">{name}</span>
              </label>
              <span className="text-[12px] text-[var(--muted)]">
                {isOff ? "Weekly holiday" : "Working day"}
              </span>
            </li>
          );
        })}
      </ul>
      <Submit>Save the week</Submit>
    </form>
  );
}
