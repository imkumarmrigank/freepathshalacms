"use client";
import { useActionState, useState } from "react";
import { completeTopic, deleteTopic } from "../actions";
import { Badge } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import HindiInput from "@/components/HindiInput";
import { fmtDate, titleCase } from "@/lib/format";

export type Topic = {
  id: number; sequence: number; topic: string; objective: string | null;
  planned_date: string | null; status: string; taught_on: string | null;
  remarks: string | null; resources_used: string | null; issues_faced: string | null;
  taught_by_name: string | null;
};

const TONE: Record<string, string> = {
  completed: "ok", in_progress: "warn", skipped: "mute", planned: "info",
};

export default function TopicRow({ t, canEdit, hindi = false }:
  { t: Topic; canEdit: boolean; hindi?: boolean }) {
  const [state, action] = useActionState(completeTopic, null);
  const [, del] = useActionState(deleteTopic, null);
  const [open, setOpen] = useState(false);
  const done = t.status === "completed";

  return (
    <li className="border-t border-[#f1f1f6] px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[#f2f2f7] text-[12px] font-semibold text-[var(--muted)]">
          {t.sequence}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[14px] font-medium ${done ? "text-[var(--muted)] line-through" : ""}`}>
              {t.topic}
            </span>
            <Badge tone={TONE[t.status]}>{titleCase(t.status)}</Badge>
            {t.planned_date && !done && (
              <span className="text-[12px] text-[var(--muted)]">planned {fmtDate(t.planned_date)}</span>
            )}
            {done && (
              <span className="text-[12px] text-[var(--muted)]">
                taught {fmtDate(t.taught_on)}{t.taught_by_name ? ` by ${t.taught_by_name}` : ""}
              </span>
            )}
          </div>
          {t.objective && <p className="mt-1 text-[13px] text-[var(--muted)]">{t.objective}</p>}

          {(t.remarks || t.resources_used || t.issues_faced) && (
            <dl className="mt-2 space-y-1 rounded-[9px] bg-[#fafaff] px-3 py-2 text-[13px]">
              {t.remarks && (
                <div><dt className="inline font-medium">How it went: </dt>
                  <dd className="inline text-[var(--muted)]">{t.remarks}</dd></div>
              )}
              {t.resources_used && (
                <div><dt className="inline font-medium">Aids &amp; references: </dt>
                  <dd className="inline text-[var(--muted)]">{t.resources_used}</dd></div>
              )}
              {t.issues_faced && (
                <div><dt className="inline font-medium">Issues faced: </dt>
                  <dd className="inline text-[var(--muted)]">{t.issues_faced}</dd></div>
              )}
            </dl>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-none gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : done ? "Edit notes" : "Mark taught"}
            </button>
            <form action={del}>
              <input type="hidden" name="topic_id" value={t.id} />
              <button className="btn btn-ghost btn-sm" type="submit">Remove</button>
            </form>
          </div>
        )}
      </div>

      {open && canEdit && (
        <form action={action} className="mt-3 rounded-[9px] border border-[var(--border)] p-4">
          <input type="hidden" name="topic_id" value={t.id} />
          <FormMessage state={state} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <label className="field">
              <span>Status</span>
              <select className="select" name="status" defaultValue={done ? "completed" : "completed"}>
                <option value="completed">Taught</option>
                <option value="in_progress">Partly covered</option>
                <option value="skipped">Skipped</option>
                <option value="planned">Back to planned</option>
              </select>
            </label>
            <label className="field">
              <span>Taught on</span>
              <input className="input" type="date" name="taught_on"
                max={new Date().toISOString().slice(0, 10)}
                defaultValue={t.taught_on ? t.taught_on.slice(0, 10) : new Date().toISOString().slice(0, 10)} />
            </label>
          </div>
          <label className="field">
            <span>How the class went</span>
            <HindiInput name="remarks" rows={2} className="textarea"
              defaultValue={t.remarks ?? ""} startInHindi={hindi}
              placeholder="Did the students follow it? What needs revising?" />
          </label>
          <label className="field">
            <span>Aids &amp; references used</span>
            <HindiInput name="resources_used" rows={2} className="textarea"
              defaultValue={t.resources_used ?? ""} startInHindi={hindi}
              placeholder="Projector, tablet, NCERT chapter 4, a YouTube explainer…" />
          </label>
          <label className="field">
            <span>Issues faced</span>
            <HindiInput name="issues_faced" rows={2} className="textarea"
              defaultValue={t.issues_faced ?? ""} startInHindi={hindi}
              placeholder="Power cut, missing textbooks, a concept most students struggled with…" />
          </label>
          <Submit>Save</Submit>
        </form>
      )}
    </li>
  );
}
