"use client";
import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { VISIT_KINDS, VISIT_KIND_BLURB, VISIT_KIND_LABEL } from "@/lib/audit-meta";
import { openVisitAt } from "./actions";

/**
 * The auditor's way in: pick the centre you are standing in and begin.
 *
 * Deliberately the first thing on their page. An auditor arrives unannounced;
 * making them wait for the office to book a visit would rule out the surprise
 * visit altogether.
 */
export default function StartVisit({ centres, preset }: {
  centres: { id: number; name: string; code: string }[];
  preset?: number | null;
}) {
  const [state, action] = useActionState(openVisitAt, null);
  const [kind, setKind] = useState("special");

  return (
    <div className="card card-pad mt-4">
      <h2 className="mb-1 text-[14px] font-semibold">Audit a centre</h2>
      <p className="mb-3 text-[12.5px] text-[var(--muted)]">
        Pick the centre you are at. If you already have one open there, it reopens
        where you left it.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <Field label="Centre *">
            <select className="select" name="center_id" required
              defaultValue={preset ? String(preset) : ""}>
              <option value="" disabled>Choose a centre</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Kind of visit">
            <select className="select" name="kind" value={kind}
              onChange={(e) => setKind(e.target.value)}>
              {VISIT_KINDS.map((k) => (
                <option key={k} value={k}>{VISIT_KIND_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <div className="mb-[15px]"><Submit>Start</Submit></div>
        </div>
        <p className="text-[12.5px] text-[var(--muted)]">
          {VISIT_KIND_BLURB[kind as keyof typeof VISIT_KIND_BLURB]}
        </p>
      </form>
    </div>
  );
}
