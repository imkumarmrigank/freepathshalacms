"use client";
import { useActionState } from "react";
import { giveCentreFeedback } from "./actions";
import { Card } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { today } from "@/lib/format";
import {
  FEEDBACK_RATINGS, FEEDBACK_TEXT as T, FEEDBACK_TOPICS, LANGUAGES, type Bi,
} from "@/lib/centre-feedback-meta";

/** A label in both languages: English on top, Hindi under it. */
function L({ t, required = false }: { t: Bi; required?: boolean }) {
  return (
    <span className="mb-1.5 block">
      <span className="block text-[13px] font-medium">
        {t.en}{required && " *"}
      </span>
      <span className="block text-[12px] text-[var(--muted)]">{t.hi}</span>
    </span>
  );
}

export default function FeedbackForm({
  centers,
}: { centers: { id: number; code: string; name: string }[] }) {
  const [state, action] = useActionState(giveCentreFeedback, null);

  return (
    <Card>
      <h2 className="text-[15px] font-semibold">{T.title.en}</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">{T.title.hi} · {T.subtitle.hi}</p>

      <form action={action}>
        <FormMessage state={state} />

        <label className="block">
          <L t={T.centre} required />
          <select className="select mb-4" name="center_id" required defaultValue="">
            <option value="">Select / चुनें</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <L t={T.visitedOn} required />
          <input className="input mb-4" type="date" name="visited_on" required
            max={today()} defaultValue={today()} />
        </label>

        <L t={T.rating} />
        <div className="mb-4 flex flex-wrap gap-3">
          {FEEDBACK_RATINGS.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 text-[13px]">
              <input type="radio" name="rating" value={r.value} className="h-4 w-4" />
              <span>{r.value} · {r.en}<span className="text-[var(--muted)]"> / {r.hi}</span></span>
            </label>
          ))}
        </div>

        <L t={T.topics} />
        <div className="mb-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {FEEDBACK_TOPICS.map((t) => (
            <label key={t.value} className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" name="topics" value={t.value} className="mt-0.5 h-4 w-4" />
              <span>{t.en}<span className="text-[var(--muted)]"> / {t.hi}</span></span>
            </label>
          ))}
        </div>

        <label className="block">
          <L t={T.workingWell} />
          <textarea className="textarea mb-4" name="working_well" rows={3}
            placeholder="The centre opens on time and the children are settled quickly." />
        </label>

        <label className="block">
          <L t={T.needsWork} />
          <textarea className="textarea mb-4" name="needs_attention" rows={3}
            placeholder="Class 2 has no mats to sit on since the rain." />
        </label>

        <label className="block">
          <L t={T.parentVoice} />
          <textarea className="textarea mb-4" name="parent_voice" rows={2}
            placeholder="Parents asked for the centre to stay open an hour longer." />
        </label>

        <label className="mb-2 flex items-start gap-2 text-[13px]">
          <input type="checkbox" name="urgent" className="mt-0.5 h-4 w-4" />
          <span>{T.urgent.en}<span className="text-[var(--muted)]"> / {T.urgent.hi}</span></span>
        </label>

        <label className="mb-4 flex items-start gap-2 text-[13px]">
          <input type="checkbox" name="share_with_centre" defaultChecked className="mt-0.5 h-4 w-4" />
          <span>{T.share.en}<span className="text-[var(--muted)]"> / {T.share.hi}</span></span>
        </label>

        <label className="block">
          <L t={T.language} />
          <select className="select mb-4" name="language" defaultValue="en">
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.en} / {l.hi}</option>
            ))}
          </select>
        </label>

        <Submit>{T.save.en} / {T.save.hi}</Submit>
      </form>
    </Card>
  );
}
