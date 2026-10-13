"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { bulkIssueToStudents } from "../actions";
import { Card, Field } from "@/components/ui";
import { FormMessage } from "@/components/form";
import { today } from "@/lib/format";

type Center = { id: number; code: string; name: string };
type Student = { id: number; label: string; center_id: number };
type Item = { id: number; name: string; unit: string; available: number };

function SubmitBtn({ canSubmit, count }: { canSubmit: boolean; count: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit || pending}>
      {pending
        ? "Recording…"
        : canSubmit
          ? `Distribute to ${count} student${count > 1 ? "s" : ""}`
          : "Distribute"}
    </button>
  );
}

export default function DistributeForm({
  centers, allStudents, items,
}: {
  centers: Center[];
  allStudents: Student[];
  items: Item[];
}) {
  const [state, action] = useActionState(bulkIssueToStudents, null);
  const [centerId, setCenterId] = useState<number | null>(
    centers.length === 1 ? centers[0].id : null,
  );
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [qtys, setQtys] = useState<Record<number, number>>({});

  const students = centerId
    ? allStudents.filter((s) => s.center_id === centerId)
    : [];

  function toggleStudent(id: number) {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedStudents(new Set(students.map((s) => s.id)));
  }
  function clearAll() {
    setSelectedStudents(new Set());
  }

  function setQty(itemId: number, val: string) {
    const n = parseInt(val, 10);
    setQtys((prev) => ({ ...prev, [itemId]: isNaN(n) || n < 0 ? 0 : n }));
  }

  const activeItems = items.filter((i) => (qtys[i.id] ?? 0) > 0);
  const canSubmit = selectedStudents.size > 0 && activeItems.length > 0;

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Distribute supplies to students</h2>
      <p className="mb-5 text-[13px] text-[var(--muted)]">
        Pick a centre, select the students, set quantities for each item, then submit.
        Each student receives the same items in the quantities you enter.
      </p>

      <form action={action}>
        <FormMessage state={state} />

        {/* hidden serialised payload */}
        <input type="hidden" name="center_id" value={centerId ?? ""} />
        <input type="hidden" name="student_ids"
          value={[...selectedStudents].join(",")} />
        <input type="hidden" name="items_json"
          value={JSON.stringify(
            activeItems.map((i) => ({ item_id: i.id, quantity: qtys[i.id] })),
          )} />
        <input type="hidden" name="issued_on" value={today()} />

        {/* 1 — Centre */}
        <Field label="Centre *">
          <select className="select" value={centerId ?? ""}
            onChange={(e) => {
              setCenterId(e.target.value ? Number(e.target.value) : null);
              setSelectedStudents(new Set());
            }} required>
            <option value="">Select centre</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
            ))}
          </select>
        </Field>

        {/* 2 — Students */}
        {centerId && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--muted)]">
                Students ({students.length} active)
              </span>
              <span className="flex gap-3 text-[12px]">
                <button type="button" className="text-[var(--brand)] hover:underline"
                  onClick={selectAll}>Select all</button>
                <button type="button" className="text-[var(--muted)] hover:underline"
                  onClick={clearAll}>Clear</button>
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)]">
              {students.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-[var(--faint)]">
                  No active students at this centre.
                </p>
              ) : (
                students.map((s) => (
                  <label key={s.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--border)] px-4 py-2.5 last:border-b-0 hover:bg-[var(--surface)]">
                    <input type="checkbox" className="h-4 w-4 rounded"
                      checked={selectedStudents.has(s.id)}
                      onChange={() => toggleStudent(s.id)} />
                    <span className="text-[13px]">{s.label}</span>
                  </label>
                ))
              )}
            </div>
            {selectedStudents.size > 0 && (
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                {selectedStudents.size} student{selectedStudents.size > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* 3 — Items */}
        <div className="mb-4">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
            Items &amp; quantities
          </span>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id}
                className="flex items-center gap-3 rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-medium">{item.name}</span>
                  <span className="ml-1.5 text-[12px] text-[var(--faint)]">
                    {item.available} {item.unit}{item.available === 1 ? "" : "s"} in hand
                    {centerId ? "" : " (all centres)"}
                  </span>
                </div>
                <input
                  type="number"
                  className="input w-20 text-right"
                  min={0}
                  max={item.available}
                  step={1}
                  placeholder="0"
                  value={qtys[item.id] ?? ""}
                  onChange={(e) => setQty(item.id, e.target.value)}
                  disabled={item.available <= 0}
                />
                <span className="w-12 text-[12px] text-[var(--muted)]">{item.unit}</span>
              </div>
            ))}
          </div>
          {activeItems.length > 0 && (
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              {activeItems.length} item{activeItems.length > 1 ? "s" : ""} with quantity &gt; 0
            </p>
          )}
        </div>

        {/* 4 — Date (read-only display) */}
        <div className="mb-4 flex items-center gap-2 text-[13px] text-[var(--muted)]">
          <span className="font-medium">Date:</span>
          <span>{today()}</span>
          <span className="text-[var(--faint)]">(today, auto-filled)</span>
        </div>

        {!canSubmit && (
          <p className="mb-3 text-[12px] text-[var(--faint)]">
            {!centerId
              ? "Select a centre to continue."
              : selectedStudents.size === 0
                ? "Select at least one student."
                : "Enter a quantity for at least one item."}
          </p>
        )}

        <SubmitBtn canSubmit={canSubmit} count={selectedStudents.size} />
      </form>
    </Card>
  );
}
