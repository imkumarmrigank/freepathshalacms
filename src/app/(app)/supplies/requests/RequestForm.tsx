"use client";
import { useActionState } from "react";
import { submitSupplyRequest, dispatchRequest, rejectRequest } from "./actions";

type Item = { id: number; name: string; unit: string; category: string };

type S = { error: string | null; ok: string | null };
const init: S = { error: null, ok: null };

const wrap = (fn: typeof submitSupplyRequest) =>
  async (_prev: S, fd: FormData): Promise<S> => {
    const res = await fn(null, fd);
    return { error: res?.error ?? null, ok: (res as { ok?: string })?.ok ?? null };
  };

export function RequestForm({ items }: { items: Item[] }) {
  const [state, action, pending] = useActionState(wrap(submitSupplyRequest), init);

  return (
    <form action={action} className="space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold">Request supplies from HQ</h2>

      <label className="block">
        <span className="label-cap mb-1.5 block">Item</span>
        <select name="item_id" className="select w-full" required>
          <option value="">Pick an item…</option>
          {Array.from(
            items.reduce<Map<string, Item[]>>((m, i) => {
              (m.get(i.category) ?? m.set(i.category, []).get(i.category))!.push(i);
              return m;
            }, new Map()),
          ).map(([cat, its]) => (
            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
              {its.map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label-cap mb-1.5 block">Quantity</span>
        <input name="quantity" type="number" min="1" step="1" className="input w-full"
          placeholder="e.g. 10" required />
      </label>

      <label className="block">
        <span className="label-cap mb-1.5 block">
          Reason <span className="font-normal text-[var(--faint)]">(optional)</span>
        </span>
        <textarea name="reason" rows={2} className="input w-full resize-none"
          placeholder="Why do you need this?" />
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Submitting…" : "Submit request"}
        </button>
        {state.ok && <span className="text-[13px] text-[var(--ok)]">{state.ok}</span>}
        {state.error && <span className="text-[13px] text-[var(--bad)]">{state.error}</span>}
      </div>
    </form>
  );
}

type RequestRow = {
  id: number; item: string; unit: string; quantity: number;
  reason: string | null; requested_on: string; status: string;
  center_name: string; requester: string; notes: string | null; handled_on: string | null;
};

export function DispatchForm({ req }: { req: RequestRow }) {
  const [dstate, daction, dpending] = useActionState(wrap(dispatchRequest), init);
  const [rstate, raction, rpending] = useActionState(wrap(rejectRequest), init);

  return (
    <div className="mt-3 space-y-3 border-t border-[#f1f1f6] pt-3">
      <form action={daction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="request_id" value={req.id} />
        <label className="block">
          <span className="label-cap mb-1 block">Qty to dispatch</span>
          <input name="quantity" type="number" min="1" step="1" defaultValue={req.quantity}
            className="input w-28" required />
        </label>
        <label className="block">
          <span className="label-cap mb-1 block">
            Challan no. <span className="font-normal text-[var(--faint)]">(opt)</span>
          </span>
          <input name="challan_no" className="input w-36" placeholder="CH-001" />
        </label>
        <label className="block flex-1 min-w-[140px]">
          <span className="label-cap mb-1 block">
            Note <span className="font-normal text-[var(--faint)]">(opt)</span>
          </span>
          <input name="notes" className="input w-full" placeholder="Any note…" />
        </label>
        <button type="submit" disabled={dpending} className="btn btn-primary mb-[1px]">
          {dpending ? "Dispatching…" : "Dispatch"}
        </button>
        {dstate.ok && <span className="text-[12px] text-[var(--ok)]">{dstate.ok}</span>}
        {dstate.error && <span className="text-[12px] text-[var(--bad)]">{dstate.error}</span>}
      </form>
      <form action={raction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="request_id" value={req.id} />
        <label className="block flex-1 min-w-[180px]">
          <span className="label-cap mb-1 block">
            Rejection reason <span className="font-normal text-[var(--faint)]">(opt)</span>
          </span>
          <input name="notes" className="input w-full" placeholder="Reason for rejecting…" />
        </label>
        <button type="submit" disabled={rpending}
          className="btn btn-ghost text-[var(--bad)] mb-[1px]">
          {rpending ? "Rejecting…" : "Reject"}
        </button>
        {rstate.ok && <span className="text-[12px] text-[var(--ok)]">{rstate.ok}</span>}
        {rstate.error && <span className="text-[12px] text-[var(--bad)]">{rstate.error}</span>}
      </form>
    </div>
  );
}
