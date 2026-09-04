"use client";
import { useActionState, useState } from "react";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import {
  saveIntro, saveTask, deleteTask, moveTask, savePitfall, deletePitfall,
} from "./actions";
import type { Manual, Note, Pitfall, Task } from "@/lib/manual-meta";

/* ------------------------------------------------------------- the opening */

export function IntroEditor({ book, lang, m }:
  { book: string; lang: string; m: Manual }) {
  const [state, action] = useActionState(saveIntro, null);
  return (
    <Card>
      <h2 className="mb-3 text-[15px] font-semibold">Opening</h2>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="book" value={book} />
        <input type="hidden" name="lang" value={lang} />
        <Field label="Headline *">
          <input className="input" name="headline" defaultValue={m.headline} required />
        </Field>
        <Field label="Opening paragraphs" hint="One paragraph per line">
          <textarea className="textarea" name="intro" rows={4}
            defaultValue={m.intro.join("\n")} />
        </Field>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Routine heading" hint="“Every teaching day”, “Each week”">
            <input className="input" name="routine_title" defaultValue={m.routine.title} />
          </Field>
          <Field label="Routine items" hint="One per line">
            <textarea className="textarea" name="routine_items" rows={4}
              defaultValue={m.routine.items.join("\n")} />
          </Field>
        </div>
        <Submit>Save opening</Submit>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------------- one task */

function noteAt(notes: Note[], i: number) {
  return notes[i] ?? { kind: "warn" as const, title: "", body: "" };
}

export function TaskEditor({ book, lang, task, index, count }: {
  book: string; lang: string; task?: Task; index?: number; count?: number;
}) {
  const [state, action] = useActionState(saveTask, null);
  const [, remove] = useActionState(deleteTask, null);
  const [, move] = useActionState(moveTask, null);
  const [open, setOpen] = useState(!task || task.id === 0);
  const notes = task?.notes ?? [];

  if (task && !open) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[12px] font-bold text-[var(--brand)]">
            {(index ?? 0) + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{task.title}</span>
          <span className="text-[12px] text-[var(--faint)]">
            {task.steps.length} step{task.steps.length === 1 ? "" : "s"}
            {task.notes.length > 0 && ` · ${task.notes.length} note`}
          </span>
          <form action={move}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="direction" value="up" />
            <button className="btn btn-ghost btn-sm" type="submit"
              disabled={index === 0} title="Move up">↑</button>
          </form>
          <form action={move}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="direction" value="down" />
            <button className="btn btn-ghost btn-sm" type="submit"
              disabled={index === (count ?? 1) - 1} title="Move down">↓</button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Edit
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-3 text-[15px] font-semibold">
        {task ? `Step ${(index ?? 0) + 1}` : "Add a step"}
      </h3>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="book" value={book} />
        <input type="hidden" name="lang" value={lang} />
        {task && task.id > 0 && <input type="hidden" name="id" value={task.id} />}

        <Field label="Title *">
          <input className="input" name="title" defaultValue={task?.title ?? ""} required
            placeholder="Mark the register" />
        </Field>
        <Field label="Why it matters" hint="One line under the title">
          <input className="input" name="why" defaultValue={task?.why ?? ""}
            placeholder="One row per child, five buttons each." />
        </Field>
        <Field label="Menu path" hint="One part per line — Attendance, then Student register">
          <textarea className="textarea" name="path" rows={2}
            defaultValue={(task?.path ?? []).join("\n")} />
        </Field>
        <Field label="Steps *" hint="One numbered step per line">
          <textarea className="textarea" name="steps" rows={6}
            defaultValue={(task?.steps ?? []).join("\n")} required />
        </Field>

        {[1, 2].map((n) => {
          const note = noteAt(notes, n - 1);
          return (
            <div key={n} className="mb-3 rounded-[9px] border border-[var(--border)] p-3">
              <div className="label-cap mb-2">Note {n} — optional</div>
              <div className="grid gap-x-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <Field label="Kind">
                  <select className="select" name={`note${n}_kind`} defaultValue={note.kind}>
                    <option value="warn">Worth knowing</option>
                    <option value="stop">Important</option>
                  </select>
                </Field>
                <Field label="Heading">
                  <input className="input" name={`note${n}_title`} defaultValue={note.title} />
                </Field>
              </div>
              <Field label="Wording">
                <textarea className="textarea" name={`note${n}_body`} rows={2}
                  defaultValue={note.body} />
              </Field>
            </div>
          );
        })}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Screenshot name"
            hint="A .png of this name in /public/manual is shown under the steps">
            <input className="input" name="shot" defaultValue={task?.shot ?? ""}
              placeholder="teacher-register" />
          </Field>
          <Field label="Restriction">
            <label className="flex items-center gap-2 pt-2 text-[13px]">
              <input type="checkbox" name="super_admin_only"
                defaultChecked={task?.superAdminOnly} />
              Mark as Super Admin only
            </label>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Submit>{task ? "Save step" : "Add step"}</Submit>
          {task && (
            <>
              <button type="button" className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}>Cancel</button>
              <span className="flex-1" />
            </>
          )}
        </div>
      </form>
      {task && (
        <form action={remove} className="mt-3 border-t border-[var(--border)] pt-3">
          <input type="hidden" name="id" value={task.id} />
          <button className="btn btn-ghost btn-sm text-[var(--bad)]" type="submit">
            Remove this step
          </button>
        </form>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------- the pitfalls */

export function PitfallEditor({ book, lang, rows }:
  { book: string; lang: string; rows: Pitfall[] }) {
  const [state, action] = useActionState(savePitfall, null);
  const [, remove] = useActionState(deletePitfall, null);

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Things that catch people out</h2>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        The message somebody sees, and what it actually means.
      </p>
      <FormMessage state={state} />

      <ul className="mb-4">
        {rows.map((p) => (
          <li key={p.id} className="border-t border-[#f1f1f6] py-2.5 first:border-t-0">
            <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <input type="hidden" name="book" value={book} />
              <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="lang" value={lang} />
              {p.id > 0 && <input type="hidden" name="id" value={p.id} />}
              <input className="input" name="problem" defaultValue={p.problem} />
              <input className="input" name="meaning" defaultValue={p.meaning} />
              <div className="flex gap-1">
                <button className="btn btn-ghost btn-sm" type="submit">Save</button>
              </div>
            </form>
            <form action={remove} className="mt-1">
              <input type="hidden" name="id" value={p.id} />
              <button className="text-[12px] text-[var(--faint)] hover:text-[var(--bad)]"
                type="submit">Remove</button>
            </form>
          </li>
        ))}
      </ul>

      <form action={action} className="grid gap-2 border-t border-[var(--border)] pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        <input type="hidden" name="book" value={book} />
        <input type="hidden" name="lang" value={lang} />
        <input className="input" name="problem" placeholder="The message they see" />
        <input className="input" name="meaning" placeholder="What it actually means" />
        <Submit>Add</Submit>
      </form>
    </Card>
  );
}
