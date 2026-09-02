import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, getCenter, listCenters } from "@/lib/queries";
import { canCreateCentre } from "@/lib/roles";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import Link from "next/link";
import CenterForm from "./CenterForm";
import ManagerPicker from "./ManagerPicker";

export default async function CentersPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireRole("super_admin", "mentor");
  const { edit } = await searchParams;
  const canCreate = canCreateCentre(user.role);
  const [centers, editing, staff] = await Promise.all([
    user.role === "super_admin" ? listCenters(false) : centersForUser(user),
    edit ? getCenter(Number(edit)) : Promise.resolve(null),
    query<{ id: number; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE role IN ('center_manager','teacher') AND is_active ORDER BY name",
    ),
  ]);

  const counts = await query<{ center_id: number; students: string; staff: string }>(
    `SELECT c.id AS center_id,
            (SELECT count(*) FROM students s WHERE s.center_id = c.id AND s.status = 'active') AS students,
            (SELECT count(*) FROM users u WHERE u.center_id = c.id AND u.is_active) AS staff
       FROM centers c`,
  );
  const byId = new Map(counts.map((c) => [Number(c.center_id), c]));

  return (
    <>
      {centers.some((c) => c.latitude == null) && (
        <div className="mb-5">
          <Alert kind="warn">
            Some centres have no location pinned, so nobody can check in there. Open the centre,
            stand at the building and tap “Use my current location”.
          </Alert>
        </div>
      )}

      <PageHeader title="Centres"
        subtitle="Each centre has one manager, its own teachers, and a geofence for staff check-in"
        right={edit ? <Link href="/manage/centers" className="btn btn-ghost">Cancel edit</Link> : undefined} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {centers.length === 0 ? (
              <Empty title="No centres yet" hint="Create your first centre using the form." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Code</th><th>Centre</th><th>Manager</th><th>Students</th><th>Staff</th><th>Geofence</th><th></th></tr>
                  </thead>
                  <tbody>
                    {centers.map((c) => (
                      <tr key={c.id}>
                        <td className="font-mono font-medium">{c.code}</td>
                        <td>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[12px] text-[var(--muted)]">
                            {[c.area, c.city].filter(Boolean).join(", ") || "—"}
                          </div>
                          {!c.is_active && <Badge tone="mute">Inactive</Badge>}
                        </td>
                        <td>
                          <ManagerPicker centerId={c.id} managerId={c.manager_id}
                            candidates={staff} />
                        </td>
                        <td className="tabular-nums">{byId.get(c.id)?.students ?? 0}</td>
                        <td className="tabular-nums">{byId.get(c.id)?.staff ?? 0}</td>
                        <td className="text-[13px] text-[var(--muted)]">
                          {c.latitude == null ? (
                            <Badge tone="warn">Not pinned</Badge>
                          ) : (
                            <>
                              <div>{c.geofence_radius_m} m radius</div>
                              <div className="font-mono text-[11px] text-[var(--faint)]">
                                {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          <Link href={`/manage/centers?edit=${c.id}`} className="btn btn-ghost btn-sm">Edit</Link>
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
          {editing || canCreate ? (
            <CenterForm center={editing} key={editing?.id ?? "new"} />
          ) : (
            <Card>
              <h2 className="mb-2 text-[15px] font-semibold">Centres you cover</h2>
              <p className="text-[13px] text-[var(--muted)]">
                Choose Edit on a centre to update its details or move its geofence. Opening a new
                centre is the administrator’s to do.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
