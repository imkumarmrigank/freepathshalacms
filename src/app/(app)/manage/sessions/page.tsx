import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { one } from "@/lib/db";
import { listSessions } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import SessionForm from "./SessionForm";
import MakeCurrent from "./MakeCurrent";

export default async function SessionsPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  await requireRole("super_admin");
  const { edit } = await searchParams;
  const sessions = await listSessions();
  const editing = edit
    ? await one<{ id: number; name: string; start_date: string; end_date: string; sequence: number }>(
        "SELECT id, name, start_date, end_date, sequence FROM academic_sessions WHERE id = $1",
        [Number(edit)])
    : null;

  return (
    <>
      <PageHeader title="Academic sessions"
        subtitle="Students are enrolled session by session; promotion moves them from one to the next"
        right={edit ? <Link href="/manage/sessions" className="btn btn-ghost">Cancel edit</Link> : undefined} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {sessions.length === 0 ? (
              <Empty title="No sessions yet" hint="Create the first academic session to begin." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Order</th><th>Session</th><th>Starts</th><th>Ends</th><th>State</th><th></th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="tabular-nums text-[var(--muted)]">{s.sequence}</td>
                        <td className="font-medium">{s.name}</td>
                        <td>{fmtDate(s.start_date)}</td>
                        <td>{fmtDate(s.end_date)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {s.is_current && <Badge tone="ok">Current</Badge>}
                            {s.is_locked && <Badge tone="mute">Locked</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {!s.is_current && <MakeCurrent id={s.id} />}
                            <Link href={`/manage/sessions?edit=${s.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <SessionForm session={editing} key={editing?.id ?? "new"}
            nextSequence={(sessions[0]?.sequence ?? 0) + 1} />
        </div>
      </div>
    </>
  );
}
