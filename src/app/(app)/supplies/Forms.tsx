"use client";
import { useActionState } from "react";
import { today } from "@/lib/format";
import { issueToStudent, recordHqReceipt, recordReceipt, saveItem } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";

type Item = { id: number; name: string; unit: string };

export function HqReceiptForm({ items }: { items: (Item & { hqAvailable: number })[] }) {
  const [state, action] = useActionState(recordHqReceipt, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Goods received at headquarters</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Everything starts here. Stock has to be received at headquarters before it can be
        dispatched to a centre.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Item *">
          <select className="select" name="item_id" required defaultValue="">
            <option value="">Select item</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.hqAvailable} {i.unit}{i.hqAvailable === 1 ? "" : "s"} at HQ
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Quantity *">
            <input className="input" type="number" name="quantity" min={1} step={1} required />
          </Field>
          <Field label="Received on">
            <input className="input" type="date" name="received_on"
              max={today()}
              defaultValue={today()} />
          </Field>
          <Field label="Supplier"><input className="input" name="supplier" /></Field>
          <Field label="Invoice no."><input className="input" name="invoice_no" /></Field>
        </div>
        <Field label="Unit cost (₹)">
          <input className="input" type="number" name="unit_cost" min={0} step="0.01" />
        </Field>
        <Field label="Remarks"><textarea className="textarea" name="remarks" rows={2} /></Field>
        <Submit>Record goods in</Submit>
      </form>
    </Card>
  );
}

export function ReceiptForm({
  items, centers,
}: {
  items: (Item & { hqAvailable: number })[];
  centers: { id: number; code: string; name: string }[];
}) {
  const [state, action] = useActionState(recordReceipt, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Dispatch stock to a centre</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Comes out of headquarters stock, and becomes what the centre can hand out.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Centre *">
          <select className="select" name="center_id" required defaultValue="">
            <option value="">Select centre</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </Field>
        <Field label="Item *">
          <select className="select" name="item_id" required defaultValue="">
            <option value="">Select item</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.hqAvailable <= 0}>
                {i.name} — {i.hqAvailable} {i.unit}{i.hqAvailable === 1 ? "" : "s"} at HQ
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Quantity *">
            <input className="input" type="number" name="quantity" min={1} step={1} required />
          </Field>
          <Field label="Dispatched on">
            <input className="input" type="date" name="received_on"
              max={today()}
              defaultValue={today()} />
          </Field>
          <Field label="Challan / bill no."><input className="input" name="challan_no" /></Field>
          <Field label="Unit cost (₹)">
            <input className="input" type="number" name="unit_cost" min={0} step="0.01" />
          </Field>
        </div>
        <Field label="Remarks"><textarea className="textarea" name="remarks" rows={2} /></Field>
        <Submit>Record stock</Submit>
      </form>
    </Card>
  );
}

export function IssueForm({
  items, students,
}: {
  items: (Item & { available: number })[];
  students: { id: number; label: string }[];
}) {
  const [state, action] = useActionState(issueToStudent, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Give items to a student</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Drawn from this centre’s stock — you cannot issue more than is in hand.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Student *">
          <select className="select" name="student_id" required defaultValue="">
            <option value="">Select student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Item *">
          <select className="select" name="item_id" required defaultValue="">
            <option value="">Select item</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.available <= 0}>
                {i.name} — {i.available} {i.unit}{i.available === 1 ? "" : "s"} in hand
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Quantity *">
            <input className="input" type="number" name="quantity" min={1} step={1}
              defaultValue={1} required />
          </Field>
          <Field label="Issued on">
            <input className="input" type="date" name="issued_on"
              max={today()}
              defaultValue={today()} />
          </Field>
        </div>
        <Field label="Remarks"><textarea className="textarea" name="remarks" rows={2} /></Field>
        <Submit>Record issue</Submit>
      </form>
    </Card>
  );
}

export function ItemForm() {
  const [state, action] = useActionState(saveItem, null);
  return (
    <Card>
      <h2 className="mb-4 text-[15px] font-semibold">Add an item to the catalogue</h2>
      <form action={action}>
        <FormMessage state={state} />
        <Field label="Item name *"><input className="input" name="name" required /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Category">
            <select className="select" name="category" defaultValue="stationery">
              {["stationery", "books", "uniform", "hygiene", "equipment", "other"].map((c) => (
                <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit"><input className="input" name="unit" defaultValue="piece" /></Field>
        </div>
        <Submit>Save item</Submit>
      </form>
    </Card>
  );
}
