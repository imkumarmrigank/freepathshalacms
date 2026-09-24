"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerQuestion, submitTest } from "../actions";
import { Card } from "@/components/ui";
import { OPTION_LETTERS } from "@/lib/staff-test-meta";

export type Q = {
  position: number; question_en: string; question_hi: string;
  options_en: string[]; options_hi: string[];
  chosen_index: number | null; correct_index: number | null;
  note_en: string | null; note_hi: string | null;
};

type Marked = { chosen: number; correct: number };

/**
 * The paper itself: one question on the screen, a clock that does not stop,
 * and an answer that cannot be taken back.
 *
 * The marking happens on the server — the browser is told which option was
 * right only once the answer is in — so the colours here are a report of what
 * the server said, never a decision this code makes.
 */
export default function TestRunner({ testId, questions, expiresAt }:
  { testId: number; questions: Q[]; expiresAt: string }) {
  const router = useRouter();
  const [at, setAt] = useState(() => {
    const first = questions.findIndex((q) => q.chosen_index === null);
    return first === -1 ? 0 : first;
  });
  const [marks, setMarks] = useState<Record<number, Marked>>(() => {
    const m: Record<number, Marked> = {};
    for (const q of questions) {
      if (q.chosen_index !== null && q.correct_index !== null)
        m[q.position] = { chosen: q.chosen_index, correct: q.correct_index };
    }
    return m;
  });
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const handedIn = useRef(false);

  // The clock is the server's: the browser only counts down to the moment the
  // paper was stamped with, so closing the phone does not buy extra minutes.
  useEffect(() => {
    const t = setInterval(() => {
      setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const handIn = useCallback(() => {
    if (handedIn.current) return;
    handedIn.current = true;
    const fd = new FormData();
    fd.set("test_id", String(testId));
    start(async () => { await submitTest(null, fd); router.refresh(); });
  }, [testId, router]);

  // Out of time: the paper goes in by itself, marked as it stands.
  useEffect(() => { if (left === 0) handIn(); }, [left, handIn]);

  const q = questions[at];
  const mark = marks[q.position];
  const over = left === 0;
  const answered = Object.keys(marks).length;
  const left_to_answer = questions.length - answered;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  function choose(i: number) {
    if (mark || over || pending) return;
    setError(null);
    const fd = new FormData();
    fd.set("test_id", String(testId));
    fd.set("position", String(q.position));
    fd.set("chosen", String(i));
    start(async () => {
      const res = await answerQuestion(null, fd) as
        { error?: string; correct_index?: number; is_correct?: boolean };
      if (res?.error) { setError(res.error); if (res.error.includes("Time")) router.refresh(); return; }
      if (typeof res?.correct_index === "number")
        setMarks((m) => ({ ...m, [q.position]: { chosen: i, correct: res.correct_index! } }));
    });
  }

  function toneOf(i: number) {
    if (!mark) return "border-[var(--border)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]";
    if (i === mark.correct) return "border-[var(--ok)] bg-[var(--ok-soft)] text-[#15803d]";
    if (i === mark.chosen) return "border-[var(--bad)] bg-[var(--bad-soft)] text-[var(--bad)]";
    return "border-[var(--border)] opacity-60";
  }

  return (
    <>
      {/* ------------------------------------------------ the clock and the count */}
      <div className="sticky top-[57px] z-10 mb-4 flex flex-wrap items-center gap-3
        rounded-[10px] border border-[var(--border)] bg-white px-4 py-3">
        <div className="text-[13px] text-[var(--muted)]">
          Question <b className="text-[var(--text)]">{at + 1}</b> of {questions.length}
          <span className="ml-3">{answered} answered</span>
          {!over && left_to_answer > 0 && (
            <span className="ml-3 text-[var(--warn)]">
              {left_to_answer} still to answer
            </span>
          )}
        </div>
        <div className={`ml-auto rounded-[8px] px-3 py-1.5 font-mono text-[15px] font-semibold
          ${over ? "bg-[var(--bad-soft)] text-[var(--bad)]"
            : left < 60 ? "bg-[var(--warn-soft)] text-[#b45309]"
            : "bg-[#f4f4f9] text-[var(--text)]"}`}>
          {over ? "Time up" : `${mm}:${ss}`}
        </div>
      </div>

      {over && (
        <div className="mb-4 rounded-[9px] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[13px] text-[var(--bad)]">
          Time is up. Nothing more can be answered — {questions.length - answered} question
          {questions.length - answered === 1 ? " was" : "s were"} left unanswered, and that is
          what your administrator will see.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-[9px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px] text-[#b45309]">
          {error}
        </div>
      )}

      {/* --------------------------------------------------------- the question */}
      <Card>
        <div className="text-[16px] font-medium leading-snug">{q.question_en}</div>
        <div className="mt-1 text-[15px] leading-snug text-[var(--muted)]">{q.question_hi}</div>

        <ul className="mt-4 space-y-2.5">
          {q.options_en.map((opt, i) => (
            <li key={i}>
              <button type="button" onClick={() => choose(i)}
                disabled={Boolean(mark) || over || pending}
                className={`flex w-full items-start gap-3 rounded-[10px] border px-3.5 py-3
                  text-left transition ${toneOf(i)} ${mark || over ? "cursor-default" : ""}`}>
                <span className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center
                  rounded-full border border-current text-[12px] font-semibold">
                  {OPTION_LETTERS[i]}
                </span>
                <span>
                  <span className="block text-[14px]">{opt}</span>
                  <span className="block text-[13px] opacity-80">{q.options_hi[i]}</span>
                </span>
                {mark && i === mark.correct && (
                  <span className="ml-auto text-[12px] font-semibold">Correct answer</span>
                )}
                {mark && i === mark.chosen && i !== mark.correct && (
                  <span className="ml-auto text-[12px] font-semibold">Your answer</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {mark && (q.note_en || q.note_hi) && (
          <div className="mt-3.5 rounded-[9px] bg-[#f4f4f9] px-3.5 py-2.5 text-[13px]">
            {q.note_en && <div>{q.note_en}</div>}
            {q.note_hi && <div className="text-[var(--muted)]">{q.note_hi}</div>}
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------------- moving about */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={at === 0}
          onClick={() => setAt((i) => Math.max(0, i - 1))}>
          ← Back
        </button>
        <button type="button" className="btn" disabled={at === questions.length - 1}
          onClick={() => setAt((i) => Math.min(questions.length - 1, i + 1))}>
          Next →
        </button>
        {/* The paper is handed in when there is nothing left to answer, or when
            the clock has taken the choice away. Finishing early, with
            questions still blank, is not a thing anyone means to do. */}
        <button type="button" className="btn btn-primary ml-auto"
          disabled={pending || (!over && left_to_answer > 0)}
          title={!over && left_to_answer > 0
            ? `${left_to_answer} question${left_to_answer === 1 ? "" : "s"} still to answer`
            : undefined}
          onClick={handIn}>
          {over ? "See the result" : "Finish the test"}
        </button>
      </div>

      {/* every question at a glance, and a way back to any of them */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {questions.map((x, i) => {
          const m = marks[x.position];
          return (
            <button key={x.position} type="button" onClick={() => setAt(i)}
              title={`Question ${i + 1}`}
              className={`h-8 w-8 rounded-[8px] border text-[12px] font-semibold ${
                i === at ? "border-[var(--brand)] ring-2 ring-[var(--brand-soft)]" : "border-[var(--border)]"} ${
                !m ? "text-[var(--faint)]"
                  : m.chosen === m.correct ? "bg-[var(--ok-soft)] text-[#15803d]"
                  : "bg-[var(--bad-soft)] text-[var(--bad)]"}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </>
  );
}
