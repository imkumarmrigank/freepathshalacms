"use client";
import { useActionState, useState } from "react";
import { Badge, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { deleteUnit, saveItems, saveUnit } from "../../syllabus/actions";

type Unit = {
  id: number; subject: string; month_no: number;
  heading: string | null; outcome: string | null; items: number;
};

/** Collapsed until opened: a class has a dozen months and most edits touch one. */
export function UnitEditor({ unit, lines }: { unit: Unit; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const [headState, saveHead] = useActionState(saveUnit, null);
  const [itemState, saveLines] = useActionState(saveItems, null);
  const [delState, remove] = useActionState(deleteUnit, null);

  return (
    <Card className="mt-4" pad={false}>
      <button type="button" onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-[var(--brand)]">
            Month {unit.month_no}
          </span>
          <span className="text-[14px] font-medium">{unit.subject}</span>
          {unit.heading && (
            <span className="text-[13px] text-[var(--muted)]">{unit.heading}</span>
          )}
          <Badge tone="mute" dot={false}>{unit.items} lines</Badge>
        </span>
        <span className="text-[13px] text-[var(--muted)]">{open ? "Close" : "Edit"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-5 py-4">
          <form action={saveHead}>
            <FormMessage state={headState} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Subject *">
                <input className="input" name="subject" defaultValue={unit.subject} required />
              </Field>
              <Field label="Month *">
                <input className="input" type="number" min={1} max={12} name="month_no"
                  defaultValue={unit.month_no} required />
              </Field>
              <Field label="Heading" hint="Unit 1, पाठ 1–2">
                <input className="input" name="heading" defaultValue={unit.heading ?? ""} />
              </Field>
            </div>
            <Field label="By the end of this month" wide
              hint="What a child should be able to do. Shown to the teacher at the top of the month.">
              <textarea className="textarea" name="outcome" rows={2}
                defaultValue={unit.outcome ?? ""} />
            </Field>
            <Submit>Save the month</Submit>
          </form>

          <form action={saveLines} className="mt-5 border-t border-[#f1f1f6] pt-4">
            <FormMessage state={itemState} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Field label="What it covers — one line each"
              hint="A teacher ticks these off as the class covers them. Leave a line's wording alone and its ticks survive the edit.">
              <textarea className="textarea text-[13px]" name="items" rows={Math.min(20, Math.max(6, lines.length + 2))}
                defaultValue={lines.join("\n")} />
            </Field>
            <Submit>Save the lines</Submit>
          </form>

          <form action={remove} className="mt-4 border-t border-[#f1f1f6] pt-3">
            <FormMessage state={delState} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Submit className="btn btn-ghost">Remove this month</Submit>
          </form>
        </div>
      )}
    </Card>
  );
}

export function NewUnit({ sessionId, classId, subjects }: {
  sessionId: number; classId: number; subjects: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveUnit, null);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary mt-5" onClick={() => setOpen(true)}>
        Add a month
      </button>
    );
  }

  return (
    <Card className="mt-5">
      <h2 className="mb-3 text-[14px] font-semibold">A new month</h2>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="class_level_id" value={classId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Subject *">
            <input className="input" name="subject" list="syllabus-subjects" required
              placeholder="English" />
            <datalist id="syllabus-subjects">
              {subjects.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label="Month *" hint="1 is the first month of the session">
            <input className="input" type="number" min={1} max={12} name="month_no"
              required defaultValue={1} />
          </Field>
          <Field label="Heading">
            <input className="input" name="heading" placeholder="Unit 1" />
          </Field>
        </div>
        <Field label="By the end of this month" wide>
          <textarea className="textarea" name="outcome" rows={2} />
        </Field>
        <div className="flex gap-2">
          <Submit>Add</Submit>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
