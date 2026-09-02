import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { currentSession, listSessions, resolveCenterId } from "@/lib/queries";
import { classProgress, loadReportCard, type ReportCardData } from "@/lib/report-card";
import ReportCard from "@/components/ReportCard";
import { Alert } from "@/components/ui";
import PrintButton from "../../students/[id]/report-card/PrintButton";

export const metadata = { title: "Report cards · FreePathshala" };

/** Guard against someone printing a whole centre in one go by accident. */
const MAX_CARDS = 80;

export default async function PrintAllPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [sessions, cur] = await Promise.all([listSessions(), currentSession()]);

  const sessionId = Number(sp.session) || cur?.id || sessions[0]?.id;
  const centerId = resolveCenterId(user, sp.center);
  const classId = Number(sp.class) || null;

  const roster = await classProgress(sessionId, centerId, classId);
  if (roster.length === 0)
    return <Alert kind="warn">No students match those filters.</Alert>;

  const capped = roster.slice(0, MAX_CARDS);
  const cards = (await Promise.all(
    capped.map((r) => loadReportCard(r.student_id, sessionId)),
  )).filter((c): c is ReportCardData => c !== null)
    // a non-admin must not print another centre's students
    .filter((c) => user.role === "super_admin" || c.student.center_id === user.centerId);

  const back = new URLSearchParams({
    session: String(sessionId),
    ...(sp.center ? { center: sp.center } : {}),
    ...(sp.class ? { class: sp.class } : {}),
  }).toString();

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/progress-reports?${back}`}
          className="text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          ← Back to progress reports
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[var(--muted)]">
            {cards.length} report card{cards.length === 1 ? "" : "s"}
            {roster.length > MAX_CARDS && ` (first ${MAX_CARDS} of ${roster.length})`}
            {" · each prints on its own page"}
          </span>
          <PrintButton />
        </div>
      </div>

      {roster.length > MAX_CARDS && (
        <div className="no-print mb-4">
          <Alert kind="warn">
            That is {roster.length} students. Only the first {MAX_CARDS} are shown — narrow it to a
            single class to print the rest.
          </Alert>
        </div>
      )}

      <div className="space-y-8">
        {cards.map((data, i) => (
          <div key={data.student.id} className={i > 0 ? "sheet-break" : undefined}>
            <ReportCard data={data} />
          </div>
        ))}
      </div>
    </>
  );
}
