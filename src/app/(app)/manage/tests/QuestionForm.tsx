"use client";
import { useActionState, useState } from "react";
import { saveQuestion } from "./actions";
import { Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { OPTION_LETTERS, TESTED_ROLES } from "@/lib/staff-test-meta";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export type Question = {
  id: number; for_role: string; topic: string | null;
  question_en: string; question_hi: string;
  options_en: string[]; options_hi: string[]; correct_index: number;
  note_en: string | null; note_hi: string | null; is_active: boolean;
};

const BLANK = ["", "", "", ""];

/**
 * Writing a question. Both languages side by side rather than one after the
 * other, because they are written as a pair and a question missing its Hindi
 * is no use to the teacher reading it.
 */
export default function QuestionForm({ question, defaultRole = "teacher", onDone }:
  { question?: Question; defaultRole?: string; onDone?: () => void }) {
  const [state, action] = useActionState(saveQuestion, null);
  const [correct, setCorrect] = useState(question?.correct_index ?? 0);
  const en = question?.options_en ?? BLANK;
  const hi = question?.options_hi ?? BLANK;
  const rows = Math.max(4, en.length);

  return (
    <Card>
      <form action={async (fd) => { await action(fd); onDone?.(); }}>
        <FormMessage state={state} />
        {question && <input type="hidden" name="id" value={question.id} />}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Whose test">
            <select className="select" name="for_role" defaultValue={question?.for_role ?? defaultRole}>
              {TESTED_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r as Role] ?? r}</option>
              ))}
            </select>
          </Field>
          <Field label="Topic" hint="optional — e.g. Attendance, Child safety">
            <input className="input" name="topic" defaultValue={question?.topic ?? ""} />
          </Field>
        </div>

        <Field label="Question (English) *">
          <textarea className="input min-h-[64px]" name="question_en" required
            defaultValue={question?.question_en ?? ""} />
        </Field>
        <Field label="प्रश्न (हिंदी) *">
          <textarea className="input min-h-[64px]" name="question_hi" required
            defaultValue={question?.question_hi ?? ""} />
        </Field>

        <div className="mb-1.5 mt-3 text-[13px] font-medium text-[var(--muted)]">
          Options — tick the right one
        </div>
        <ul className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <label className="mt-2.5 flex flex-none items-center gap-1.5"
                title={`Mark ${OPTION_LETTERS[i]} as the right answer`}>
                <input type="radio" name="correct_index" value={i} className="h-4 w-4"
                  checked={correct === i} onChange={() => setCorrect(i)} />
                <span className="text-[13px] font-semibold text-[var(--muted)]">{OPTION_LETTERS[i]}</span>
              </label>
              <input className="input" name={`option_en_${i}`} placeholder="English"
                defaultValue={en[i] ?? ""} />
              <input className="input" name={`option_hi_${i}`} placeholder="हिंदी"
                defaultValue={hi[i] ?? ""} />
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
          Leave a row empty to have fewer options. Two is the minimum.
        </p>

        <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
          <Field label="Why that is the answer (English)" hint="shown after they answer">
            <input className="input" name="note_en" defaultValue={question?.note_en ?? ""} />
          </Field>
          <Field label="उत्तर का कारण (हिंदी)">
            <input className="input" name="note_hi" defaultValue={question?.note_hi ?? ""} />
          </Field>
        </div>

        {question && (
          <label className="mb-3 flex items-center gap-2.5">
            <input type="checkbox" name="is_active" className="h-4 w-4"
              defaultChecked={question.is_active} />
            <span className="text-[13px]">In use — unticked, it is never asked again</span>
          </label>
        )}

        <Submit>{question ? "Save question" : "Add question"}</Submit>
      </form>
    </Card>
  );
}
