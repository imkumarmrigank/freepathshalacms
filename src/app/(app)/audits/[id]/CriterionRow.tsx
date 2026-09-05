"use client";
import { useActionState, useState } from "react";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import {
  BANDS, BAND_LABEL, BAND_NEEDS_REASON,
  type Criterion, type RatingRow,
} from "@/lib/audit-meta";
import { saveRating } from "../actions";

/**
 * One point on the checklist.
 *
 * The four bands are shown with the wording the super admin gave them, so the
 * auditor picks between described situations — "90% or more of the roll present"
 * — rather than deciding for themselves what a 3 out of 4 means. A weak rating
 * asks for a reason, because a low score nobody explained is not much use to the
 * centre that has to act on it.
 */
export default function CriterionRow({ criterion, visitId, existing }: {
  criterion: Criterion; visitId: number; existing: RatingRow | null;
}) {
  const [state, action] = useActionState(saveRating, null);
  const [band, setBand] = useState<number | null>(existing?.band ?? null);
  const needsReason = band != null && band > 0 && band <= BAND_NEEDS_REASON;

  return (
    <li className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="visit_id" value={visitId} />
        <input type="hidden" name="criterion_id" value={criterion.id} />

        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-[14.5px] font-medium">{criterion.title}</h3>
          {existing && (
            <span className="text-[12px] text-[var(--ok)]">saved</span>
          )}
        </div>
        <p className="mt-0.5 text-[13.5px] text-[var(--muted)]">{criterion.question}</p>

        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {BANDS.map((b, i) => (
            <label key={b} className="pick">
              <input type="radio" name="band" value={b}
                checked={band === b}
                onChange={() => setBand(b)} />
              <span>
                <b>{criterion.band_labels[i] ?? BAND_LABEL[b]}</b>
                {criterion.band_labels[i] && <em>{BAND_LABEL[b]}</em>}
              </span>
            </label>
          ))}
          <label className="pick">
            <input type="radio" name="band" value={0}
              checked={band === 0} onChange={() => setBand(0)} />
            <span><b>Does not apply</b><em>Left out of the score</em></span>
          </label>
        </div>

        {needsReason && criterion.reasons.length > 0 && (
          <div className="mt-3">
            <Field label="Main reason *">
              <select className="select" name="reason" required
                defaultValue={existing?.reason ?? ""}>
                <option value="" disabled>Pick the main reason</option>
                {criterion.reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        )}

        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Field label="Note (optional)">
              <input className="input" name="note" defaultValue={existing?.note ?? ""}
                placeholder="Anything the centre should know" />
            </Field>
          </div>
          <div className="mb-[1px]"><Submit>Save</Submit></div>
        </div>
      </form>
    </li>
  );
}
