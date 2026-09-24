"use client";
import { useActionState, useState } from "react";
import { deleteQuestion } from "./actions";
import QuestionForm, { type Question } from "./QuestionForm";
import { Badge } from "@/components/ui";
import { FormMessage } from "@/components/form";
import { OPTION_LETTERS } from "@/lib/staff-test-meta";

/** One question in the bank: read it, open it to edit, or take it out. */
export default function QuestionRow({ question, used }:
  { question: Question; used: number }) {
  const [editing, setEditing] = useState(false);
  const [state, remove] = useActionState(deleteQuestion, null);

  if (editing) {
    return (
      <li className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
        <QuestionForm question={question} onDone={() => setEditing(false)} />
        <button type="button" className="btn btn-ghost btn-sm mt-2"
          onClick={() => setEditing(false)}>Cancel</button>
      </li>
    );
  }

  return (
    <li className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium">{question.question_en}</div>
          <div className="text-[13px] text-[var(--muted)]">{question.question_hi}</div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {question.options_en.map((o, i) => (
              <li key={i}
                className={`rounded-full px-2.5 py-1 text-[12px] ${
                  i === question.correct_index
                    ? "bg-[var(--ok-soft)] text-[#15803d]"
                    : "bg-[#f4f4f9] text-[var(--muted)]"}`}>
                {OPTION_LETTERS[i]}. {o}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-none items-center gap-2">
          {question.topic && <Badge tone="mute">{question.topic}</Badge>}
          {!question.is_active && <Badge tone="warn">Retired</Badge>}
          {used > 0 && (
            <span className="text-[12px] text-[var(--faint)]" title="times it has been asked">
              asked {used}×
            </span>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <form action={remove}>
            <input type="hidden" name="id" value={question.id} />
            <button className="btn btn-ghost btn-sm text-[var(--bad)]" type="submit">
              {used > 0 ? "Retire" : "Delete"}
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
