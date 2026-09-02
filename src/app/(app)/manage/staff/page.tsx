import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { centersForUser } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { fmtDateTime } from "@/lib/format";
import StaffForm, { type Staff } from "./StaffForm";

export default async function StaffPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  if (user.role === "teacher")
    return <Alert kind="bad">You don’t have access to staff management.</Alert>;

  const { edit } = await searchParams;
  const centers = await centersForUser(user);
  const scope = user.role === "super_admin" ? "" : " AND u.center_id = $1";
  const params = user.role === "super_admin" ? [] : [user.centerId];

  const rows = await query<{
    id: number; name: string; email: string; phone: string | null; role: Role;
    center_id: number | null; center_name: string | null; designation: string | null;
    is_active: boolean; last_login_at: string | null; is_manager: boolean;
  }>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.center_id, c.name AS center_name,
            u.designation, u.is_active, u.last_login_at,
            (c.manager_id = u.id) AS is_manager
       FROM users u LEFT JOIN centers c ON c.id = u.center_id
      WHERE 1=1 ${scope}
      ORDER BY u.role, u.name`,
    params,
  );

  const editing = edit
    ? await one<Staff>(
        "SELECT id, name, email, phone, role, center_id, designation, is_active FROM users WHERE id = $1",
        [Number(edit)])
    : null;

  return (
    <>
      <PageHeader title="Staff"
        subtitle={user.role === "super_admin"
          ? "Managers and teachers across all centres"
          : `Teachers at ${user.centerName}`}
        right={edit ? <Link href="/manage/staff" className="btn btn-ghost">Cancel edit</Link> : undefined} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title="No staff yet" hint="Add your first teacher using the form." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Name</th><th>Role</th><th>Centre</th><th>Last login</th><th></th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} size={32} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.name}</div>
                              <div className="truncate text-[12px] text-[var(--muted)]">{r.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={r.role === "super_admin" ? "info" : r.role === "mentor" ? "warn"
                              : r.role === "center_manager" ? "ok" : "mute"}>
                              {ROLE_LABEL[r.role]}
                            </Badge>
                            {r.is_manager && <Badge tone="info" dot={false}>Centre head</Badge>}
                            {!r.is_active && <Badge tone="bad">Disabled</Badge>}
                          </div>
                        </td>
                        <td className="text-[var(--muted)]">{r.center_name ?? "—"}</td>
                        <td className="text-[13px] text-[var(--muted)]">
                          {r.last_login_at ? fmtDateTime(r.last_login_at) : "Never"}
                        </td>
                        <td><Link href={`/manage/staff?edit=${r.id}`} className="btn btn-ghost btn-sm">Edit</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <StaffForm staff={editing} centers={centers} key={editing?.id ?? "new"}
            isAdmin={user.role === "super_admin"} ownCenterId={user.centerId} />
        </div>
      </div>
    </>
  );
}
