"use client";
import { useEffect, useState, useTransition } from "react";
import { loadPaper } from "../actions";
import { Badge } from "@/components/ui";
import { OPTION_LETTERS, TEST_STATUS_LABEL, TEST_STATUS_TONE, pct } from "@/lib/staff-test-meta";
import { fmtDate } from "@/lib/format";

type Paper = Awaited<ReturnType<typeof loadPaper>>;

/**
 * The paper behind a row: every question as it was asked, what the person
 * picked and what was right. Fetched when it is opened, because a page of
 * twenty-five results has no business carrying twenty-five papers with it.
 */
export default function PaperModal({ testId, onClose }:
  { testId: number; onClose: () => void }) {
  const [data, setData] = useState<Paper | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => setData(await loadPaper(testId)));
  }, [testId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const test = data && "test" in data ? data.test : null;
  const paper = data && "paper" in data && data.paper ? data.paper : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[760px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-start gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">
              {test ? test.name : "Loading…"}
            </div>
            {test && (
              <div className="mt-0.5 text-[13px] text-[var(--muted)]">
                {test.center_name ?? "—"} ·{" "}
                {new Date(test.cycle_month).toLocaleDateString("en-IN",
                  { month: "long", year: "numeric" })}{" "}
                · test {test.slot} · taken {fmtDate(test.started_at)}
                {test.minutes != null && ` · ${test.minutes} of ${test.duration_minutes} min`}
              </div>
            )}
          </div>
          {test && (
            <div className="flex flex-none items-center gap-2">
              <span className="text-[15px] font-semibold tabular-nums">
                {test.score ?? 0} of {test.total}
                <span className="ml-1 text-[13px] font-normal text-[var(--muted)]">
                  {pct(test.score ?? 0, test.total)}%
                </span>
              </span>
              <Badge tone={TEST_STATUS_TONE[test.status]}>
                {TEST_STATUS_LABEL[test.status] ?? test.status}
              </Badge>
            </div>
          )}
          <button type="button" onClick={onClose}
            className="rounded-md px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[#f1f1f8]">
            Close
          </button>
        </div>

        <div className="px-5 py-4">
          {!data ? (
            <p className="text-[13px] text-[var(--muted)]">Fetching the paper…</p>
          ) : paper.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">This paper has no questions on it.</p>
          ) : (
            <ol className="space-y-4">
              {paper.map((q) => (
                <li key={q.position}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-[2px] flex h-[22px] w-[22px] flex-none items-center
                      justify-center rounded-full text-[12px] font-semibold ${
                        q.chosen_index === null ? "bg-[var(--warn-soft)] text-[#b45309]"
                          : q.is_correct ? "bg-[var(--ok-soft)] text-[#15803d]"
                          : "bg-[var(--bad-soft)] text-[var(--bad)]"}`}>
                      {q.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium leading-snug">{q.question_en}</div>
                      <div className="text-[13px] leading-snug text-[var(--muted)]">{q.question_hi}</div>
                      <ul className="mt-2 space-y-1.5">
                        {q.options_en.map((opt, i) => {
                          const right = i === q.correct_index;
                          const mine = i === q.chosen_index;
                          return (
                            <li key={i}
                              className={`rounded-[8px] border px-3 py-1.5 text-[13px] ${
                                right ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[#15803d]"
                                  : mine ? "border-[var(--bad)] bg-[var(--bad-soft)] text-[var(--bad)]"
                                  : "border-[var(--border)] text-[var(--muted)]"}`}>
                              <span className="font-semibold">{OPTION_LETTERS[i]}. </span>
                              {opt}
                              <span className="text-[var(--muted)]"> · {q.options_hi[i]}</span>
                              {right && <span className="ml-2 text-[12px] font-semibold">Correct</span>}
                              {mine && !right && (
                                <span className="ml-2 text-[12px] font-semibold">Their answer</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {q.chosen_index === null && (
                        <p className="mt-1.5 text-[12.5px] text-[#b45309]">
                          Left unanswered{test?.status === "expired" ? " — the time ran out" : ""}.
                        </p>
                      )}
                      {q.topic && (
                        <p className="mt-1 text-[12px] text-[var(--faint)]">{q.topic}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
