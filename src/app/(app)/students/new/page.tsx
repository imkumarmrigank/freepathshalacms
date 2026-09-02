import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { centersForUser, currentSession, listClasses } from "@/lib/queries";
import { Alert, Card, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import AdmissionWizard from "./AdmissionWizard";
import type { AdmissionPayload } from "./actions";

export const metadata = { title: "New admission · FreePathshala CMS" };

export default async function NewStudentPage({
  searchParams,
}: { searchParams: Promise<{ draft?: string }> }) {
  const user = await requireUser();
  const { draft: draftParam } = await searchParams;

  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);

  if (user.role === "teacher" || user.role === "backup_teacher")
    return (
      <Alert kind="bad">
        Only the centre manager can admit a student. Pass the details to your manager.
      </Alert>
    );
  if (!session)
    return <Alert kind="warn">No academic session is open. An administrator must create one first.</Alert>;
  if (centers.length === 0)
    return <Alert kind="warn">You are not assigned to a centre yet. Ask your administrator.</Alert>;

  const draftId = draftParam ? Number(draftParam) : null;
  const draftRow = draftId
    ? await one<{ payload: AdmissionPayload }>(
        "SELECT payload FROM admission_drafts WHERE id = $1 AND created_by = $2",
        [draftId, user.uid])
    : null;

  // anything left half-finished, so it can be picked back up
  const drafts = await query<{
    id: number; student_name: string | null; updated_at: string; center_name: string | null;
  }>(
    `SELECT d.id, d.student_name, d.updated_at, c.name AS center_name
       FROM admission_drafts d
       LEFT JOIN centers c ON c.id = d.center_id
      WHERE d.created_by = $1 ORDER BY d.updated_at DESC LIMIT 6`,
    [user.uid],
  );

  return (
    <>
      <PageHeader
        title="New Student Admission"
        subtitle="Complete the student’s details to create a new student profile."
        back={{ href: "/students", label: "Students" }}
      />

      {drafts.length > 0 && !draftId && (
        <Card className="mb-5">
          <h2 className="mb-1 text-[15px] font-semibold">Unfinished admissions</h2>
          <p className="mb-3 text-[13px] text-[var(--muted)]">
            Saved drafts you can pick up where you left off.
          </p>
          <ul className="divide-y divide-[#f1f1f6]">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">
                    {d.student_name || "Unnamed student"}
                  </span>
                  <span className="block text-[12px] text-[var(--muted)]">
                    {d.center_name ? `${d.center_name} · ` : ""}saved {fmtDateTime(d.updated_at)}
                  </span>
                </span>
                <Link href={`/students/new?draft=${d.id}`} className="btn btn-ghost btn-sm">
                  Continue Admission
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AdmissionWizard
        centers={centers.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        sessionName={session.name}
        draft={draftRow?.payload ?? null}
        draftId={draftId}
      />
    </>
  );
}
