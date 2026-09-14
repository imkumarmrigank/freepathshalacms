import { requireRole } from "@/lib/auth";
import { Alert, Card, PageHeader } from "@/components/ui";
import { currentSession, listClasses } from "@/lib/queries";
import { itemsFor, subjectsFor, unitsFor } from "@/lib/syllabus";
import Link from "next/link";
import { UnitEditor, NewUnit } from "./Editors";

export const metadata = { title: "Set the syllabus · Pehchaan" };

export default async function ManageSyllabusPage({
  searchParams,
}: { searchParams: Promise<{ class?: string; subject?: string }> }) {
  await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const [classes, session] = await Promise.all([listClasses(), currentSession()]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const classId = Number(sp.class) || classes[0]?.id;
  if (!classId) return <Alert kind="warn">No classes are set up yet.</Alert>;

  const subjects = await subjectsFor(session.id, classId);
  const units = await unitsFor(session.id, classId, null, sp.subject || null);
  const withItems = await Promise.all(units.map(async (u) => ({
    ...u, lines: (await itemsFor(u.id, null)).map((i) => i.text),
  })));

  const className = classes.find((c) => c.id === classId)?.name ?? "";

  return (
    <>
      <PageHeader
        title="Set the syllabus"
        subtitle={`What every centre teaches in ${className}, month by month`}
        back={{ href: "/syllabus", label: "Syllabus" }}
      />

      <Card className="mt-4">
        <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
          This is the same syllabus for every centre. Teachers cannot change it — they work
          through it and record how far their own centre has got. Editing a line here keeps
          the ticks of any line whose wording you leave alone, so correcting a typo does not
          wipe a term of a teacher&rsquo;s work.
        </p>
      </Card>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {classes.map((c) => (
          <Link key={c.id} href={`/manage/syllabus?class=${c.id}`}
            className={`rounded-full px-3 py-1.5 text-[12.5px] ${
              c.id === classId
                ? "bg-[var(--brand)] text-white"
                : "bg-[#f4f4f9] text-[var(--muted)] hover:bg-[#ececf3]"}`}>
            {c.name}
          </Link>
        ))}
      </div>

      {subjects.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Link href={`/manage/syllabus?class=${classId}`}
            className={`rounded-full px-3 py-1 text-[12px] ${
              !sp.subject ? "bg-[#e8e8f5]" : "bg-[#f7f7fb] text-[var(--muted)]"}`}>
            All subjects
          </Link>
          {subjects.map((s) => (
            <Link key={s} href={`/manage/syllabus?class=${classId}&subject=${encodeURIComponent(s)}`}
              className={`rounded-full px-3 py-1 text-[12px] ${
                sp.subject === s ? "bg-[#e8e8f5]" : "bg-[#f7f7fb] text-[var(--muted)]"}`}>
              {s}
            </Link>
          ))}
        </div>
      )}

      {withItems.length === 0 ? (
        <Card className="mt-5">
          <p className="text-[13.5px] text-[var(--muted)]">
            Nothing set for {className} yet. Add the first month below.
          </p>
        </Card>
      ) : (
        withItems.map((u) => <UnitEditor key={u.id} unit={u} lines={u.lines} />)
      )}

      <NewUnit sessionId={session.id} classId={classId} subjects={subjects} />
    </>
  );
}
