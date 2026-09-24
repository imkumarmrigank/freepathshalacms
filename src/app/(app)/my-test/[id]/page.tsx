import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { closeIfExpired, paperOf, testById, testConfig } from "@/lib/staff-tests";
import {
  OPTION_LETTERS, TEST_STATUS_LABEL, TEST_STATUS_TONE, pct, slotLabel,
} from "@/lib/staff-test-meta";
import TestRunner from "./TestRunner";

export const metadata = { title: "Test · Pehchaan" };

/**
 * One paper: the test while it runs, the result once it is in. Both live at
 * the same address, because a person coming back to a finished test is asking
 * "how did I do?", not "let me in again".
 */
export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const found = await testById(Number(id));
  if (!found || found.user_id !== user.uid) notFound();

  const test = await closeIfExpired(found);
  const running = test.status === "in_progress";
  const [paper, cfg] = await Promise.all([paperOf(test.id, !running), testConfig(test.for_role)]);

  if (running) {
    return (
      <>
        <PageHeader title={slotLabel(test.slot, cfg.tests_per_month)}
          subtitle={`${paper.length} questions · answer one at a time · the clock does not stop`}
          back={{ href: "/my-test", label: "My test" }} />
        {/* one paper's answers must never carry into another's */}
        <TestRunner key={test.id} testId={test.id} expiresAt={test.expires_at}
          questions={paper.map((q) => ({
            position: q.position,
            question_en: q.question_en, question_hi: q.question_hi,
            options_en: q.options_en, options_hi: q.options_hi,
            chosen_index: q.chosen_index, correct_index: q.correct_index,
            note_en: q.note_en, note_hi: q.note_hi,
          }))} />
      </>
    );
  }

  const score = test.score ?? 0;
  const share = pct(score, test.total);
  const unanswered = paper.filter((q) => q.chosen_index === null).length;

  return (
    <>
      <PageHeader title={`${slotLabel(test.slot, cfg.tests_per_month)} · result`}
        subtitle={`Taken on ${fmtDate(test.started_at)}`}
        back={{ href: "/my-test", label: "My test" }}
        right={<Badge tone={TEST_STATUS_TONE[test.status]}>
          {TEST_STATUS_LABEL[test.status] ?? test.status}
        </Badge>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Score" value={`${score} of ${test.total}`}
          hint={`${share}%`} tone={share >= 60 ? "ok" : share >= 40 ? "warn" : "bad"} />
        <StatCard label="Right" value={score} />
        <StatCard label="Wrong or left out" value={test.total - score}
          hint={unanswered
            ? `${unanswered} not answered${test.status === "expired" ? " — time ran out" : ""}`
            : "all answered"}
          tone={unanswered ? "warn" : "default"} />
      </div>

      <div className="label-cap mb-2.5 mt-6">Question by question</div>
      <div className="space-y-3">
        {paper.map((q) => (
          <Card key={q.position}>
            <div className="flex items-start gap-2">
              <span className="mt-[2px] flex h-[22px] w-[22px] flex-none items-center justify-center
                rounded-full bg-[#f4f4f9] text-[12px] font-semibold text-[var(--muted)]">
                {q.position}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium leading-snug">{q.question_en}</div>
                <div className="mt-0.5 text-[14px] leading-snug text-[var(--muted)]">{q.question_hi}</div>
                <ul className="mt-3 space-y-1.5">
                  {q.options_en.map((opt, i) => {
                    const right = i === q.correct_index;
                    const mine = i === q.chosen_index;
                    return (
                      <li key={i}
                        className={`rounded-[9px] border px-3 py-2 text-[13.5px] ${
                          right ? "border-[var(--ok)] bg-[var(--ok-soft)] text-[#15803d]"
                            : mine ? "border-[var(--bad)] bg-[var(--bad-soft)] text-[var(--bad)]"
                            : "border-[var(--border)] text-[var(--muted)]"}`}>
                        <span className="font-semibold">{OPTION_LETTERS[i]}. </span>
                        {opt}
                        <span className="text-[var(--muted)]"> · {q.options_hi[i]}</span>
                        {right && <span className="ml-2 text-[12px] font-semibold">Correct answer</span>}
                        {mine && !right && <span className="ml-2 text-[12px] font-semibold">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
                {q.chosen_index === null && (
                  <p className="mt-2 text-[13px] text-[var(--warn)]">
                    Not answered{test.status === "expired" ? " — the time ran out." : "."}
                  </p>
                )}
                {(q.note_en || q.note_hi) && (
                  <div className="mt-2.5 rounded-[9px] bg-[#f4f4f9] px-3 py-2 text-[13px]">
                    {q.note_en && <div>{q.note_en}</div>}
                    {q.note_hi && <div className="text-[var(--muted)]">{q.note_hi}</div>}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-[13px] text-[var(--muted)]">
        <Link href="/my-test" className="text-[var(--brand)] hover:underline">Back to my tests</Link>
      </p>
    </>
  );
}
