"use client";
import { useActionState, useState } from "react";
import { Badge, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import type { Criterion, ScoreSettings } from "@/lib/audit-meta";
import { retireCriterion, saveCriterion, saveScoring } from "./actions";

/** Collapsed until opened: the list is long, and most visits change nothing. */
export function CriterionEditor({ c }: { c: Criterion }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCriterion, null);
  const [retireState, retire] = useActionState(retireCriterion, null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)}
          className="text-[14px] font-medium hover:text-[var(--brand)]">
          {c.title}
        </button>
        <Badge tone="mute" dot={false}>weight {c.weight}</Badge>
        {!c.is_active && <Badge tone="bad">Retired</Badge>}
        <span className="text-[12.5px] text-[var(--muted)]">{c.question}</span>
      </div>

      {open && (
        <>
          <form action={action} className="mt-3">
            <FormMessage state={state} />
            <input type="hidden" name="id" value={c.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Section *">
                <input className="input" name="section" defaultValue={c.section} required />
              </Field>
              <Field label="Title *">
                <input className="input" name="title" defaultValue={c.title} required />
              </Field>
            </div>
            <Field label="The question the auditor answers *">
              <input className="input" name="question" defaultValue={c.question} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="The four bands, best first">
                <textarea className="textarea" name="band_labels" rows={4}
                  defaultValue={c.band_labels.join("\n")}
                  placeholder={"90% or more present\n75–89% present\n50–74% present\nBelow 50%"} />
              </Field>
              <Field label="Reasons offered for a weak rating">
                <textarea className="textarea" name="reasons" rows={4}
                  defaultValue={c.reasons.join("\n")}
                  placeholder={"One per line"} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Weight (1–5)">
                <input className="input" type="number" min="1" max="5" name="weight"
                  defaultValue={c.weight} />
              </Field>
              <Field label="Order">
                <input className="input" type="number" name="position" defaultValue={c.position} />
              </Field>
            </div>
            <div className="flex justify-end"><Submit>Save</Submit></div>
          </form>

          <form action={retire} className="mt-1 flex items-center gap-3">
            <FormMessage state={retireState} />
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="active" value={c.is_active ? "0" : "1"} />
            <Submit className="btn btn-ghost">
              {c.is_active ? "Retire this criterion" : "Put it back in use"}
            </Submit>
          </form>
        </>
      )}
    </>
  );
}

export function NewCriterion({ sections }: { sections: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCriterion, null);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary mt-5" onClick={() => setOpen(true)}>
        Add a criterion
      </button>
    );
  }

  return (
    <Card className="mt-5">
      <h2 className="mb-3 text-[14px] font-semibold">A new criterion</h2>
      <form action={action}>
        <FormMessage state={state} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Section *">
            <input className="input" name="section" list="audit-sections" required
              placeholder="Children" />
            <datalist id="audit-sections">
              {sections.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label="Title *">
            <input className="input" name="title" required placeholder="Attendance" />
          </Field>
        </div>
        <Field label="The question the auditor answers *">
          <input className="input" name="question" required
            placeholder="How was today's attendance?" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="The four bands, best first">
            <textarea className="textarea" name="band_labels" rows={4}
              placeholder={"90% or more present\n75–89% present\n50–74% present\nBelow 50%"} />
          </Field>
          <Field label="Reasons offered for a weak rating">
            <textarea className="textarea" name="reasons" rows={4} placeholder="One per line" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Weight (1–5)">
            <input className="input" type="number" min="1" max="5" name="weight" defaultValue={1} />
          </Field>
          <Field label="Order">
            <input className="input" type="number" name="position" defaultValue={999} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <Submit>Add</Submit>
        </div>
      </form>
    </Card>
  );
}

export function ScoringEditor({ settings }: { settings: ScoreSettings }) {
  const [state, action] = useActionState(saveScoring, null);
  const [weight, setWeight] = useState(settings.ratingWeightPct);

  return (
    <Card className="mt-5">
      <h2 className="mb-1 text-[14px] font-semibold">How the award is scored</h2>
      <p className="mb-3 text-[12.5px] text-[var(--muted)]">
        Tune this once you have seen a month of real data.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <Field label={`How the centre was found on the day: ${weight}% — acting on suggestions: ${100 - weight}%`}>
          <input type="range" min="0" max="100" step="5" name="rating_weight_pct"
            value={weight} onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full accent-[var(--brand)]" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Done properly">
            <input className="input" type="number" min="0" max="100" name="points_done_well"
              defaultValue={settings.pointsDoneWell} />
          </Field>
          <Field label="Done, but late">
            <input className="input" type="number" min="0" max="100" name="points_late"
              defaultValue={settings.pointsLate} />
          </Field>
          <Field label="Partly done">
            <input className="input" type="number" min="0" max="100" name="points_partly"
              defaultValue={settings.pointsPartly} />
          </Field>
          <Field label="Not done">
            <input className="input" type="number" min="0" max="100" name="points_not_done"
              defaultValue={settings.pointsNotDone} />
          </Field>
        </div>
        <div className="flex justify-end"><Submit>Save scoring</Submit></div>
      </form>
    </Card>
  );
}
