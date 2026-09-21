import Link from "next/link";
import { notFound } from "next/navigation";
import { canTouchCenter, requireFeature } from "@/lib/auth";
import { currentSession } from "@/lib/queries";
import { Alert, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { marksFor, playersOf, sportById, testById } from "@/lib/sports";
import { SportMarksSheet } from "../../../SportForms";

export default async function SportTestPage({
  params,
}: { params: Promise<{ id: string; testId: string }> }) {
  const user = await requireFeature("sports");
  const { id, testId } = await params;
  const sport = await sportById(Number(id));
  const test = await testById(Number(testId));
  if (!sport || !test || test.sport_id !== sport.id || !canTouchCenter(user, sport.center_id))
    notFound();

  const session = await currentSession();
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const [players, saved] = await Promise.all([playersOf(sport.id, session.id), marksFor(test.id)]);

  return (
    <>
      <Link href={`/sports/${sport.id}?tab=tests`}
        className="mb-2 inline-block text-[13px] text-[var(--muted)] hover:underline">
        ← {sport.name} · {sport.center_name}
      </Link>
      <PageHeader title={test.title}
        subtitle={`${fmtDate(test.test_date)} · out of ${Number(test.max_marks)} · ${players.length} playing`} />
      {players.length === 0
        ? <Alert kind="warn">Nobody is on this sport&rsquo;s list yet.</Alert>
        : <SportMarksSheet testId={test.id} max={Number(test.max_marks)} players={players} saved={saved} />}
    </>
  );
}
