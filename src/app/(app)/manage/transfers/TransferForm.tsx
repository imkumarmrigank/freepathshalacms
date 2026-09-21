"use client";
import { useActionState, useMemo, useState } from "react";
import { transferStudent } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage } from "@/components/form";
import { today } from "@/lib/format";

export type Pupil = {
  id: number; name: string; enrollment_no: string; center_id: number; center_name: string;
  class_id: number | null; class_name: string | null; father_name: string | null;
};

export default function TransferForm({
  pupils, centres, classes, preselect,
}: {
  pupils: Pupil[];
  centres: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
  preselect: number | null;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Pupil | null>(
    () => pupils.find((p) => p.id === preselect) ?? null);
  // A done transfer clears the form for the next child, keeping the message.
  const [state, action, pending] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const r = await transferStudent(prev, fd);
      if (r.ok) setPicked(null);
      return r;
    }, null);
  const [to, setTo] = useState("");
  const [cls, setCls] = useState<string>(() => String(picked?.class_id ?? ""));

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return pupils.filter((p) =>
      `${p.name} ${p.enrollment_no} ${p.father_name ?? ""}`.toLowerCase().includes(n)).slice(0, 12);
  }, [q, pupils]);

  const choose = (p: Pupil) => { setPicked(p); setQ(""); setTo(""); setCls(String(p.class_id ?? "")); };
  const target = centres.find((c) => String(c.id) === to);
  const classChanged = picked && cls !== "" && cls !== String(picked.class_id ?? "");

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Transfer a student</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Pick the child, then where they are going. Their enrolment number stays the same.
      </p>

      <form action={action}>
        <FormMessage state={state} />

        {!picked ? (
          <Field label="Student *" hint="Type at least two letters of the name, enrolment no. or father's name">
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search students" autoFocus />
            {matches.length > 0 && (
              <div className="mt-2 max-h-[300px] overflow-y-auto rounded-lg border border-[var(--border)]">
                {matches.map((p) => (
                  <button key={p.id} type="button" onClick={() => choose(p)}
                    className="flex w-full items-center gap-2 border-b border-[#f1f1f6] px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-[#fafaff]">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{p.name}</span>
                      {p.father_name && <span className="text-[var(--muted)]"> · s/o, d/o {p.father_name}</span>}
                    </span>
                    <span className="text-[12px] text-[var(--muted)]">{p.center_name} · {p.class_name ?? "—"}</span>
                    <span className="font-mono text-[11px] text-[var(--faint)]">{p.enrollment_no}</span>
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && matches.length === 0 && (
              <p className="mt-2 text-[13px] text-[var(--muted)]">No active student matches that.</p>
            )}
          </Field>
        ) : (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-[#fafaff] px-3 py-2.5">
            <input type="hidden" name="student_id" value={picked.id} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{picked.name}</div>
                <div className="text-[12px] text-[var(--muted)]">
                  {picked.enrollment_no} · now at <strong>{picked.center_name}</strong>, {picked.class_name ?? "no class this session"}
                </div>
              </div>
              <button type="button" className="text-[12px] underline" onClick={() => setPicked(null)}>
                Change
              </button>
            </div>
          </div>
        )}

        {picked && (
          <>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Move to centre *">
                <select className="select" name="to_center_id" required value={to}
                  onChange={(e) => setTo(e.target.value)}>
                  <option value="">Select centre</option>
                  {centres.filter((c) => c.id !== picked.center_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Class there" hint={classChanged ? "Class will change" : "Same class unless you change it"}>
                <select className="select" name="to_class_id" value={cls} onChange={(e) => setCls(e.target.value)}>
                  {!picked.class_id && <option value="">Select class</option>}
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Date of transfer *">
                <input className="input" type="date" name="transferred_on" required
                  defaultValue={today()} max={today()} />
              </Field>
              <Field label="Reason">
                <input className="input" name="reason" placeholder="Family moved to Sector 46" />
              </Field>
            </div>

            <label className="mb-1 flex items-start gap-2 text-[13px]">
              <input type="checkbox" name="move_history" defaultChecked className="mt-0.5 h-4 w-4" />
              <span>
                Move this year&rsquo;s attendance, PTM records and counselling referrals with the child
              </span>
            </label>
            <p className="mb-4 pl-6 text-[12px] text-[var(--muted)]">
              Open follow-ups and open referrals always move. Test marks stay with the tests the old
              centre held but still appear on the child&rsquo;s report card. Supplies handed out stay
              in the old centre&rsquo;s stock count.
            </p>

            <button className="btn btn-primary" type="submit" disabled={!to || pending}>
              {pending ? "Transferring…"
                : target ? `Transfer ${picked.name} to ${target.name}` : "Transfer"}
            </button>
          </>
        )}
      </form>
    </Card>
  );
}
