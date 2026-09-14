"use client";
import { useActionState, useState, useTransition } from "react";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { markMonth, tickItem } from "../actions";
import { today } from "@/lib/format";
import type { Item } from "@/lib/syllabus";

/**
 * A month's lines, and the monthly mark underneath them.
 *
 * Ticking a line saves on its own — a teacher works through a month over weeks
 * and should not have to press Save to record that today's lesson happened.
 * The monthly mark is the deliberate act, so that one keeps its button.
 */
export default function MonthWork({
  unitId, centerId, items, mayMark, status, remarks, completedOn,
}: {
  unitId: number;
  centerId: number | null;
  items: Item[];
  mayMark: boolean;
  status: string;
  remarks: string | null;
  completedOn: string | null;
}) {
  const [state, action] = useActionState(markMonth, null);
  const [pick, setPick] = useState(status);
  const [ticked, setTicked] = useState<Record<number, boolean>>(
    () => Object.fromEntries(items.map((i) => [i.id, Boolean(i.done_on)])));
  const [, start] = useTransition();
  const [tickError, setTickError] = useState<string | null>(null);

  const toggle = (itemId: number, next: boolean) => {
    setTicked((t) => ({ ...t, [itemId]: next }));      // show it at once
    const body = new FormData();
    body.set("item_id", String(itemId));
    body.set("done", next ? "1" : "0");
    if (centerId) body.set("center_id", String(centerId));
    start(async () => {
      const res = await tickItem(null, body);
      if (res?.error) {
        setTicked((t) => ({ ...t, [itemId]: !next }));  // put it back
        setTickError(res.error);
      }
    });
  };

  const doneCount = items.filter((i) => ticked[i.id]).length;

  return (
    <>
      <Card className="mt-5" pad={false}>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[14px] font-semibold">What this month covers</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            {mayMark
              ? "Tick a line as your class covers it. Each tick saves on its own."
              : "Set by the administration. Teachers record progress against it."}
          </p>
        </div>
        {tickError && (
          <p className="px-5 pt-3 text-[13px] text-[var(--bad)]">{tickError}</p>
        )}
        <ul>
          {items.map((i) => (
            <li key={i.id} className="border-t border-[#f1f1f6] first:border-0">
              <label className={`flex items-start gap-3 px-5 py-3 ${
                mayMark ? "cursor-pointer hover:bg-[#fafafd]" : ""}`}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                  checked={Boolean(ticked[i.id])} disabled={!mayMark}
                  onChange={(e) => toggle(i.id, e.target.checked)} />
                <span className={`text-[13.5px] leading-relaxed ${
                  ticked[i.id] ? "text-[var(--muted)] line-through" : ""}`}>
                  {i.text}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      {mayMark && (
        <Card className="mt-5">
          <h2 className="mb-1 text-[14px] font-semibold">Where this month stands</h2>
          <p className="mb-3 text-[12.5px] text-[var(--muted)]">
            {doneCount} of {items.length} lines ticked. Marking the month complete is what
            the centre is measured on, so do it when the class has genuinely finished.
          </p>
          <form action={action}>
            <FormMessage state={state} />
            <input type="hidden" name="unit_id" value={unitId} />
            {centerId && <input type="hidden" name="center_id" value={centerId} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <select className="select" name="status" value={pick}
                  onChange={(e) => setPick(e.target.value)}>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">Under way</option>
                  <option value="completed">Completed</option>
                </select>
              </Field>
              {pick === "completed" && (
                <Field label="Finished on">
                  <input className="input" type="date" name="completed_on"
                    defaultValue={completedOn ?? today()} />
                </Field>
              )}
            </div>
            <Field label="Remarks" hint="Anything that held the class up, or what needs revisiting.">
              <textarea className="textarea" name="remarks" rows={2}
                defaultValue={remarks ?? ""} />
            </Field>
            <Submit>Save</Submit>
          </form>
        </Card>
      )}
    </>
  );
}
