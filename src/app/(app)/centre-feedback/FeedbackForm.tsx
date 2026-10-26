"use client";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { giveCentreFeedback } from "./actions";
import { FormMessage } from "@/components/form";
import { today } from "@/lib/format";
import {
  ASSESSMENT_PARAMS, BAND_LABEL, SCORE_OPTIONS, consolidate, type Ratings,
} from "@/lib/centre-feedback-meta";

export type DraftValues = {
  id: number; centerId: number; visitedOn: string; ratings: Ratings;
  workingWell: string; needsAttention: string; parentVoice: string;
};

const BAND_COLOUR: Record<string, string> = {
  insufficient: "#64748b", good: "#2f6f46", average: "#b7791f", below: "#c0392b",
};

/** "English | हिन्दी" — both languages on one line, as on the paper sheet. */
function Bi({ en, hi }: { en: string; hi: string }) {
  return <>{en} <span className="text-[var(--muted)]">| {hi}</span></>;
}

function Section({ title, hi, hint, children }: {
  title: string; hi: string; hint?: string; children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="text-[12px] text-[var(--muted)]">{hi}</div>
      {hint && <p className="mt-1 text-[12px] italic text-[var(--muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 -mx-1 mt-4 grid grid-cols-[1fr_1.4fr] gap-3 bg-[var(--bg,#f8faf9)] px-1 py-3">
      <button type="submit" name="intent" value="draft" formNoValidate disabled={pending}
        className="btn btn-ghost justify-center">Save as Draft</button>
      <button type="submit" name="intent" value="submit" disabled={pending}
        className="btn justify-center text-white" style={{ background: "#2f5d3f" }}>
        {pending ? "Saving…" : "Submit Feedback"}
      </button>
    </div>
  );
}

export default function FeedbackForm({
  centers, mentorName, draft, previous,
}: {
  centers: { id: number; code: string; name: string }[];
  mentorName: string;
  draft: DraftValues | null;
  previous: ReactNode;
}) {
  const [state, action] = useActionState(giveCentreFeedback, null);
  const [ratings, setRatings] = useState<Ratings>(draft?.ratings ?? {});
  const sum = consolidate(ratings);

  return (
    <form action={action} className="mx-auto max-w-[640px] space-y-4">
      {draft && <input type="hidden" name="draft_id" value={draft.id} />}

      <div className="rounded-2xl px-4 py-4 text-white" style={{ background: "#2f5d3f" }}>
        <div className="text-[16px] font-semibold">FreePathshala | Centre Feedback</div>
        <div className="mt-0.5 text-[12px]">केंद्र फ़ीडबैक · Mentor Visit Assessment</div>
        <div className="mt-2 text-[11px] italic opacity-90">
          Help us improve the quality of education across our centres.
        </div>
      </div>

      <FormMessage state={state} />

      <Section title="Visit Details" hi="दौरे का विवरण">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-[12px]">
            Centre Name *
            <select className="select mt-1" name="center_id" required
              defaultValue={draft?.centerId ?? (centers.length === 1 ? centers[0].id : "")}>
              <option value="">Select centre</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-[12px]">
            Date of Visit *
            <input className="input mt-1" type="date" name="visited_on" required
              max={today()} defaultValue={draft?.visitedOn ?? today()} />
          </label>
          <label className="block text-[12px]">
            Mentor Name
            <input className="input mt-1 bg-[#f1f5f9]" value={mentorName} readOnly />
          </label>
        </div>
      </Section>

      {previous}

      <Section title="Centre Quality Assessment" hi="केंद्र की गुणवत्ता का आकलन"
        hint="Select one rating for each parameter based on your observations.">
        <div className="space-y-5">
          {ASSESSMENT_PARAMS.map((p, i) => {
            const v = ratings[p.key];
            const set = (n: number) => setRatings((r) => ({ ...r, [p.key]: n }));
            return (
              <div key={p.key}>
                <div className="mb-2 text-[13px] font-semibold">
                  {i + 1}. <Bi en={p.en} hi={p.hi} />
                </div>
                {v !== undefined && <input type="hidden" name={`rating_${p.key}`} value={v} />}
                <div className="grid grid-cols-3 gap-2.5">
                  {SCORE_OPTIONS.map((o) => (
                    <button key={o.value} type="button" onClick={() => set(o.value)}
                      aria-pressed={v === o.value}
                      className="rounded-xl border px-2 py-3 text-center text-[11px] leading-tight"
                      style={v === o.value
                        ? { background: BAND_COLOUR[o.value === 3 ? "good" : o.value === 2 ? "average" : "below"],
                            borderColor: "transparent", color: "#fff" }
                        : { borderColor: "var(--border-strong)" }}>
                      <span className="block text-[11px] font-semibold uppercase">{o.en}</span>
                      <span className="block text-[10px]">{o.hi}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => set(0)} aria-pressed={v === 0}
                  className="mt-2 rounded-full border px-2.5 py-1 text-[10px]"
                  style={v === 0
                    ? { background: "#475569", color: "#fff", borderColor: "transparent" }
                    : { borderColor: "var(--border-strong)", color: "var(--muted)" }}>
                  Not Observed | अवलोकन नहीं किया
                </button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Mentor Observations" hi="मेंटर का अवलोकन">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px]">
            <Bi en="What is working well?" hi="क्या अच्छा चल रहा है?" />
            <textarea className="textarea mt-1" name="working_well" rows={3}
              defaultValue={draft?.workingWell ?? ""}
              placeholder="Mention positive observations, good practices or progress." />
          </label>
          <label className="block text-[12px]">
            <Bi en="What needs attention?" hi="किस पर ध्यान देने की ज़रूरत है?" />
            <textarea className="textarea mt-1" name="needs_attention" rows={3}
              defaultValue={draft?.needsAttention ?? ""}
              placeholder="Describe the issue and suggested improvement." />
          </label>
        </div>
        <label className="mt-3 block text-[12px]">
          <Bi en="Parent Feedback" hi="अभिभावकों की प्रतिक्रिया" />
          <textarea className="textarea mt-1" name="parent_voice" rows={3}
            defaultValue={draft?.parentVoice ?? ""}
            placeholder="Record key feedback shared by parents, if applicable." />
        </label>
      </Section>

      <section className="rounded-2xl border border-[var(--border)] bg-[#f1f5fb] px-4 py-5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider">
          Consolidated Centre Quality Rating
        </div>
        <div className="text-[10px] text-[var(--muted)]">केंद्र की समग्र गुणवत्ता रेटिंग</div>
        <div className="mt-3 text-[26px] font-semibold tabular-nums">
          {sum.score === null ? "—" : sum.score.toFixed(2)}
          <span className="text-[14px] font-normal text-[var(--muted)]"> / 3.00</span>
        </div>
        <span className="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-semibold text-white"
          style={{ background: BAND_COLOUR[sum.band] }}>
          {BAND_LABEL[sum.band].en} | {BAND_LABEL[sum.band].hi}
        </span>
        <div className="mt-3 text-[11px]">Based on {sum.rated} of 6 parameters rated.</div>
        <div className="text-[10px] text-[var(--muted)]">
          Rating breakdown: {sum.good} Good · {sum.average} Average · {sum.below} Below Average
        </div>
      </section>

      <Buttons />
    </form>
  );
}
