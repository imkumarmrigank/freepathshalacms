import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentSession, listSessions } from "@/lib/queries";
import { loadReportCard } from "@/lib/report-card";
import ReportCard from "@/components/ReportCard";
import { Alert } from "@/components/ui";
import { fullName } from "@/lib/format";
import PrintButton from "./PrintButton";

export const metadata = { title: "Progress report · FreePathshala" };

export default async function ReportCardPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { session: sessionParam } = await searchParams;

  const [sessions, cur] = await Promise.all([listSessions(), currentSession()]);
  const sessionId = Number(sessionParam) || cur?.id || sessions[0]?.id;

  const data = await loadReportCard(Number(id), sessionId);
  if (!data) notFound();
  if (user.role !== "super_admin" && data.student.center_id !== user.centerId)
    return <Alert kind="bad">This student belongs to another centre.</Alert>;

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/students/${data.student.id}`}
          className="text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
          ← Back to {fullName(data.student)}
        </Link>
        <div className="flex items-center gap-2">
          {sessions.length > 1 && (
            <form className="flex items-center gap-2">
              <select className="select w-auto" name="session" defaultValue={String(sessionId)}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
                ))}
              </select>
              <button className="btn btn-ghost btn-sm" type="submit">Show</button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      <ReportCard data={data} />
    </>
  );
}
