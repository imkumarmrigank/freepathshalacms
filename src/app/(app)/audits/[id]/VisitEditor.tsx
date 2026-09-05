"use client";
import Link from "next/link";
import { useActionState, useMemo } from "react";
import { Badge, Card, Field, PageHeader } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { fmtDate } from "@/lib/format";
import {
  OVERALLS, OVERALL_BLURB, OVERALL_LABEL, PRIORITIES, PRIORITY_LABEL,
  VERDICTS, VERDICT_LABEL, VISIT_KIND_LABEL,
  type Criterion, type RatingRow, type SuggestionRow, type VisitRow,
} from "@/lib/audit-meta";
import {
  addSuggestion, saveVisitDetails, submitVisit, verifySuggestion,
} from "../actions";
import CriterionRow from "./CriterionRow";

/**
 * The auditor's working screen.
 *
 * Everything saves where it stands rather than at the end. A visit is filled in
 * on a phone, standing in a centre, on a connection that comes and goes — losing
 * twenty minutes of work to one failed submit at the end would be unforgivable,
 * so each rating is its own small save.
 */
export default function VisitEditor({
  visit, criteria, ratings, suggestions, outstanding, roll,
}: {
  visit: VisitRow;
  criteria: Criterion[];
  ratings: RatingRow[];
  suggestions: SuggestionRow[];
  outstanding: SuggestionRow[];
  /** What the system has on the roll here — a starting figure, not an answer. */
  roll: { children: number; staff: number } | null;
}) {
  const done = useMemo(
    () => new Map(ratings.map((r) => [r.criterion_id, r])), [ratings]);
  const sections = useMemo(() => {
    const m = new Map<string, Criterion[]>();
    for (const c of criteria) m.set(c.section, [...(m.get(c.section) ?? []), c]);
    return [...m.entries()];
  }, [criteria]);

  const rated = criteria.filter((c) => done.has(c.id)).length;

  return (
    <>
      <PageHeader
        title={visit.center_name}
        subtitle={`${VISIT_KIND_LABEL[visit.kind]} · ${
          visit.visited_on ? fmtDate(visit.visited_on) : "today"}`}
        right={<Link href="/audits" className="btn btn-ghost">Leave</Link>}
      />

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ececf3]">
          <div className="h-full rounded-full bg-[var(--brand)] transition-[width]"
            style={{ width: `${criteria.length ? (rated / criteria.length) * 100 : 0}%` }} />
        </div>
        <span className="text-[12.5px] tabular-nums text-[var(--muted)]">
          {rated} of {criteria.length} checked
        </span>
      </div>

      {/* ------------------------------------------- what was here already */}
      {outstanding.length > 0 && (
        <Card className="mt-5" pad={false}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[14px] font-semibold">
              Still owed from earlier visits
            </h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              Check these first. Read what the centre said, then give your verdict.
            </p>
          </div>
          <ul>
            {outstanding.map((s) => (
              <Verify key={s.id} s={s} visitId={visit.id} />
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------- the snapshot */}
      <Snapshot visit={visit} roll={roll} />

      {/* -------------------------------------------------------- the checks */}
      {sections.map(([name, list]) => (
        <Card key={name} className="mt-5" pad={false}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[14px] font-semibold">{name}</h2>
          </div>
          <ul>
            {list.map((c) => (
              <CriterionRow key={c.id} criterion={c} visitId={visit.id}
                existing={done.get(c.id) ?? null} />
            ))}
          </ul>
        </Card>
      ))}

      {/* ---------------------------------------------------- the suggestions */}
      <NewSuggestion visitId={visit.id} criteria={criteria} raised={suggestions} />

      <FileReport visit={visit} rated={rated} />
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Snapshot({ visit, roll }: {
  visit: VisitRow; roll: { children: number; staff: number } | null;
}) {
  const [state, action] = useActionState(saveVisitDetails, null);
  return (
    <Card className="mt-5">
      <h2 className="mb-1 text-[14px] font-semibold">Today&rsquo;s snapshot</h2>
      <p className="mb-3 text-[12.5px] text-[var(--muted)]">
        {roll
          ? `On roll here: ${roll.children} children, ${roll.staff} staff expected today —
             filled in for you. Correct them if the records are out of date, and count
             the children present yourself.`
          : "Count the children and staff actually present."}
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="visit_id" value={visit.id} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Children present">
            <input className="input" type="number" min="0" name="children_present"
              defaultValue={visit.children_present ?? ""} />
          </Field>
          <Field label="Children on roll">
            <input className="input" type="number" min="0" name="children_on_roll"
              defaultValue={visit.children_on_roll ?? roll?.children ?? ""} />
          </Field>
          <Field label="Staff present">
            <input className="input" type="number" min="0" name="staff_present"
              defaultValue={visit.staff_present ?? ""} />
          </Field>
          <Field label="Staff expected">
            <input className="input" type="number" min="0" name="staff_on_roll"
              defaultValue={visit.staff_on_roll ?? roll?.staff ?? ""} />
          </Field>
        </div>

        <div className="mt-4">
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
            How did you find the centre overall? *
          </span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {OVERALLS.map((o) => (
              <label key={o} className="pick">
                <input type="radio" name="overall" value={o}
                  defaultChecked={visit.overall === o} />
                <span>
                  <b>{OVERALL_LABEL[o]}</b>
                  <em>{OVERALL_BLURB[o]}</em>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Field label="Anything worth writing down">
            <textarea className="textarea" name="summary" rows={3}
              defaultValue={visit.summary ?? ""}
              placeholder="What you saw, in your own words." />
          </Field>
        </div>

        <div className="mt-3 flex justify-end"><Submit>Save snapshot</Submit></div>
      </form>
    </Card>
  );
}

function Verify({ s, visitId }: { s: SuggestionRow; visitId: number }) {
  const [state, action] = useActionState(verifySuggestion, null);
  return (
    <li className="border-t border-[#f1f1f6] px-5 py-3.5 first:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[14px] font-medium">{s.title}</span>
        <Badge tone={s.priority === "critical" ? "bad" : s.priority === "high" ? "warn" : "mute"}>
          {PRIORITY_LABEL[s.priority]}
        </Badge>
        {s.overdue && <Badge tone="bad" dot={false}>Overdue</Badge>}
        <Link href={`/audits/suggestions/${s.id}`}
          className="text-[12.5px] text-[var(--brand)] hover:underline">
          {Number(s.replies) > 0 ? `read ${s.replies} repl${Number(s.replies) === 1 ? "y" : "ies"}` : "open"}
        </Link>
      </div>
      {s.detail && <p className="mt-1 text-[13px] text-[var(--muted)]">{s.detail}</p>}
      <form action={action} className="mt-2">
        <FormMessage state={state} />
        <input type="hidden" name="suggestion_id" value={s.id} />
        <input type="hidden" name="visit_id" value={visitId} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[170px]">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">
              Your verdict
            </span>
            <select className="select w-auto" name="verdict" defaultValue="">
              <option value="" disabled>Choose</option>
              {VERDICTS.map((v) => (
                <option key={v} value={v}>{VERDICT_LABEL[v]}</option>
              ))}
            </select>
          </label>
          <div className="min-w-[220px] flex-1">
            <Field label="Note (optional)">
              <input className="input" name="note" placeholder="What you saw this time" />
            </Field>
          </div>
          <div className="mb-[1px]"><Submit>Record</Submit></div>
        </div>
      </form>
    </li>
  );
}

function NewSuggestion({ visitId, criteria, raised }: {
  visitId: number; criteria: Criterion[]; raised: SuggestionRow[];
}) {
  const [state, action] = useActionState(addSuggestion, null);
  return (
    <Card className="mt-5">
      <h2 className="mb-1 text-[14px] font-semibold">Suggestions for this centre</h2>
      <p className="mb-3 text-[12.5px] text-[var(--muted)]">
        What the manager and teachers should have done by your next visit.
      </p>

      {raised.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {raised.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-[9px] bg-[#f7f7fb] px-3 py-2">
              <span className="text-[13.5px] font-medium">{s.title}</span>
              <Badge tone={s.priority === "critical" ? "bad"
                : s.priority === "high" ? "warn" : "mute"}>
                {PRIORITY_LABEL[s.priority]}
              </Badge>
              {s.due_on && (
                <span className="text-[12px] text-[var(--muted)]">by {fmtDate(s.due_on)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="visit_id" value={visitId} />
        <div className="grid gap-3">
          <Field label="What needs doing *">
            <input className="input" name="title" required
              placeholder="Fix the broken door on the toilet" />
          </Field>
          <Field label="Any detail">
            <textarea className="textarea" name="detail" rows={2}
              placeholder="Who to speak to, what good looks like." />
          </Field>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Priority">
            <select className="select" name="priority" defaultValue="medium">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Due by">
            <input className="input" type="date" name="due_on" />
          </Field>
          <Field label="Against which check">
            <select className="select" name="criterion_id" defaultValue="">
              <option value="">Not tied to one</option>
              {criteria.map((c) => (
                <option key={c.id} value={c.id}>{c.section} — {c.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-3 flex justify-end"><Submit>Add suggestion</Submit></div>
      </form>
    </Card>
  );
}

function FileReport({ visit, rated }: { visit: VisitRow; rated: number }) {
  const [state, action] = useActionState(submitVisit, null);
  const ready = rated > 0 && Boolean(visit.overall);
  return (
    <Card className="mt-5">
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="visit_id" value={visit.id} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">File the report</h2>
            <p className="text-[12.5px] text-[var(--muted)]">
              {ready
                ? "Once filed the ratings are fixed, and the centre can see it."
                : "Set how you found the centre, and rate at least one point, before filing."}
            </p>
          </div>
          <Submit>File report</Submit>
        </div>
      </form>
    </Card>
  );
}
