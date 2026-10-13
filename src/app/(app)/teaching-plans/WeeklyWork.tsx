"use client";
import { useActionState, useTransition, useState } from "react";
import { Card } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { tickItem, saveWeekRemarks } from "@/app/(app)/syllabus/actions";
import type { Item } from "@/lib/syllabus";

type WeekRemark = { week_no: number; remarks: string | null };

export default function WeeklyWork({
  unitId,
  centerId,
  weekNo,
  items,
  subject,
  termNo,
  monthNo,
  monthLabel,
  className,
  existingRemarks,
}: {
  unitId: number;
  centerId: number;
  weekNo: number;
  items: Item[];
  subject: string;
  termNo: number;
  monthNo: number;
  monthLabel: string;
  className: string;
  existingRemarks: WeekRemark | null;
}) {
  const weekItems = items.filter((i) => i.week_no === weekNo);
  const [ticked, setTicked] = useState<Record<number, boolean>>(
    () => Object.fromEntries(weekItems.map((i) => [i.id, Boolean(i.done_on)])),
  );
  const [, start] = useTransition();
  const [tickError, setTickError] = useState<string | null>(null);
  const [remarkState, remarkAction] = useActionState(saveWeekRemarks, null);

  const toggle = (itemId: number, next: boolean) => {
    setTicked((t) => ({ ...t, [itemId]: next }));
    const body = new FormData();
    body.set("item_id", String(itemId));
    body.set("done", next ? "1" : "0");
    body.set("center_id", String(centerId));
    start(async () => {
      const res = await tickItem(null, body);
      if (res?.error) {
        setTicked((t) => ({ ...t, [itemId]: !next }));
        setTickError(res.error);
      }
    });
  };

  const doneCount = weekItems.filter((i) => ticked[i.id]).length;

  if (weekItems.length === 0) return null;

  return (
    <Card className="mt-4" pad={false}>
      <div className="border-b border-[var(--border)] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[14px] font-semibold">{subject}</span>
            <span className="mx-2 text-[var(--muted)]">·</span>
            <span className="text-[13px] text-[var(--muted)]">{className}</span>
            <span className="mx-2 text-[var(--muted)]">·</span>
            <span className="text-[12px] text-[var(--muted)]">T{termNo} · {monthLabel}, Week {weekNo}</span>
          </div>
          <span className="text-[12px] text-[var(--muted)]">
            {doneCount} of {weekItems.length} taught
          </span>
        </div>
      </div>

      {tickError && (
        <p className="px-5 pt-3 text-[13px] text-[var(--bad)]">{tickError}</p>
      )}

      <ul>
        {weekItems.map((i) => (
          <li key={i.id} className="border-t border-[#f1f1f6] first:border-0">
            <label className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-[#fafafd]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--brand)]"
                checked={Boolean(ticked[i.id])}
                onChange={(e) => toggle(i.id, e.target.checked)}
              />
              <span className={`text-[13.5px] leading-relaxed ${ticked[i.id] ? "text-[var(--muted)] line-through" : ""}`}>
                {i.text}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {/* Week-level remarks */}
      <div className="border-t border-[var(--border)] px-5 py-4">
        <form action={remarkAction}>
          <input type="hidden" name="unit_id" value={unitId} />
          <input type="hidden" name="center_id" value={centerId} />
          <input type="hidden" name="week_no" value={weekNo} />
          <FormMessage state={remarkState} />
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--muted)] uppercase tracking-[0.05em]">
              Remarks for this week
            </span>
            <textarea
              className="textarea w-full"
              name="remarks"
              rows={2}
              placeholder="Any notes on what was covered, what to revisit…"
              defaultValue={existingRemarks?.remarks ?? ""}
            />
          </label>
          <div className="mt-2">
            <Submit>Save remarks</Submit>
          </div>
        </form>
      </div>
    </Card>
  );
}
