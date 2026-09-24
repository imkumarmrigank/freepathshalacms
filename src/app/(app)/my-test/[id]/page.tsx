import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Badge, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { closeIfExpired, paperOf, testById, testConfig } from "@/lib/staff-tests";
import { TEST_STATUS_LABEL, TEST_STATUS_TONE, pct, slotLabel } from "@/lib/staff-test-meta";
import TestRunner from "./TestRunner";

export const metadata = { title: "Test · Pehchaan" };

/**
 * One paper: the test while it runs, the score once it is in.
 *
 * The questions are shown while the test is being taken — each one marked the
 * moment it is answered — and not afterwards. The same questions come round
 * for other staff, so a paper that can be read back is a paper that can be
 * passed on; what remains is the score, and the office can see the rest.
 */
export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const found = await testById(Number(id));
  if (!found || found.user_id !== user.uid) notFound();

  const test = await closeIfExpired(found);
  const running = test.status === "in_progress";
  // The paper is fetched for the test itself; once it is over, only the
  // count of what was left unanswered is read from it.
  const [paper, cfg] = await Promise.all([paperOf(test.id, running), testConfig(test.for_role)]);

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

      <p className="mt-5 text-[13px] text-[var(--muted)]">
        The questions are not shown again after a test — the same ones come round for
        other staff, and a paper that can be read afterwards is a paper that can be
        passed on. Your administrator can see how each question went.
      </p>

      <p className="mt-5 text-[13px] text-[var(--muted)]">
        <Link href="/my-test" className="text-[var(--brand)] hover:underline">Back to my tests</Link>
      </p>
    </>
  );
}
