import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { Alert, Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import { CoverageForm, EndCoverage } from "./CoverageForm";

export const metadata = { title: "Backup cover · FreePathshala CMS" };

export default async function CoveragePage() {
  await requireFeature("coverage");

  const [rows, backups, teachers] = await Promise.all([
    query<{
      id: number; backup: string; covering: string; center_name: string;
      starts_on: string; ends_on: string | null; reason: string | null;
      assigned_by: string | null;
    }>(
      `SELECT tc.id, b.name AS backup, t.name AS covering, c.name AS center_name,
              tc.starts_on, tc.ends_on, tc.reason, a.name AS assigned_by
         FROM teacher_coverage tc
         JOIN users b ON b.id = tc.backup_id
         JOIN users t ON t.id = tc.covering_id
         JOIN centers c ON c.id = tc.center_id
         LEFT JOIN users a ON a.id = tc.assigned_by
        ORDER BY (tc.ends_on IS NULL OR tc.ends_on >= CURRENT_DATE) DESC,
                 tc.starts_on DESC`),
    query<{ id: number; name: string; center_name: string | null }>(
      `SELECT u.id, u.name, c.name AS center_name FROM users u
         LEFT JOIN centers c ON c.id = u.center_id
        WHERE u.is_active AND u.role = 'backup_teacher' ORDER BY u.name`),
    query<{ id: number; name: string; center_name: string | null }>(
      `SELECT u.id, u.name, c.name AS center_name FROM users u
         LEFT JOIN centers c ON c.id = u.center_id
        WHERE u.is_active AND u.role = 'teacher' ORDER BY c.code, u.name`),
  ]);

  const isLive = (r: { starts_on: string; ends_on: string | null }) =>
    r.starts_on <= today() && (r.ends_on === null || r.ends_on >= today());
  const live = rows.filter(isLive).length;

  return (
    <>
      <PageHeader
        title="Backup cover"
        subtitle={`${live} stand-in${live === 1 ? "" : "s"} running today`}
      />

      {backups.length > 0 && teachers.length === 0 && (
        <div className="mb-4">
          <Alert kind="warn">There are no regular teachers to cover for yet.</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title="No cover assigned yet"
                hint="Assign a backup teacher when a regular teacher is away." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Backup teacher</th><th>Covering</th><th>Centre</th>
                      <th>From</th><th>Until</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const running = isLive(r);
                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={r.backup} size={30} />
                              <span className="font-medium">{r.backup}</span>
                            </div>
                          </td>
                          <td className="text-[var(--muted)]">{r.covering}</td>
                          <td className="text-[var(--muted)]">{r.center_name}</td>
                          <td className="whitespace-nowrap">{fmtDate(r.starts_on)}</td>
                          <td className="whitespace-nowrap text-[var(--muted)]">
                            {r.ends_on ? fmtDate(r.ends_on) : "Open ended"}
                          </td>
                          <td>
                            {running
                              ? <Badge tone="ok">Running</Badge>
                              : r.starts_on > today()
                                ? <Badge tone="info">Upcoming</Badge>
                                : <Badge tone="mute">Ended</Badge>}
                            {r.reason && (
                              <div className="text-[12px] text-[var(--muted)]">{r.reason}</div>
                            )}
                          </td>
                          <td className="text-right">{running && <EndCoverage id={r.id} />}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <CoverageForm backups={backups} teachers={teachers} />
        </div>
      </div>
    </>
  );
}
