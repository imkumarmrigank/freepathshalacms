import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate, minutesToHours, titleCase, today } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import OverrideForm from "./OverrideForm";

const TONE: Record<string, string> = {
  present: "ok", late: "warn", absent: "bad", leave: "mute", holiday: "mute",
};

export default async function StaffAttendancePage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role === "teacher")
    return <Alert kind="bad">You don’t have access to the staff register.</Alert>;

  const sp = await searchParams;
  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, sp.center);
  const date = sp.date || today();

  const params: unknown[] = [date];
  let scope = "";
  if (centerId) { params.push(centerId); scope = ` AND u.center_id = $${params.length}`; }

  const rows = await query<{
    user_id: number; name: string; role: Role; center_name: string | null;
    check_in_at: string | null; check_out_at: string | null; worked_minutes: number | null;
    status: string | null; check_in_distance_m: number | null;
    within_geofence: boolean | null; override_by_name: string | null; override_reason: string | null;
  }>(
    `SELECT u.id AS user_id, u.name, u.role, c.name AS center_name,
            a.check_in_at, a.check_out_at, a.worked_minutes, a.status,
            a.check_in_distance_m, a.within_geofence, o.name AS override_by_name,
            a.override_reason
       FROM users u
       LEFT JOIN centers c ON c.id = u.center_id
       LEFT JOIN staff_attendance a ON a.user_id = u.id AND a.att_date = $1
       LEFT JOIN users o ON o.id = a.override_by
      WHERE u.is_active AND u.role IN ('center_manager','teacher') ${scope}
      ORDER BY c.code, u.role, u.name`,
    params,
  );

  const staffList = rows.map((r) => ({ id: r.user_id, name: r.name }));
  const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const time = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  return (
    <>
      <PageHeader title="Staff attendance"
        subtitle={`${present} of ${rows.length} checked in on ${fmtDate(date)}`} />

      <Filters
        centers={user.role === "super_admin" ? centers : []}
        current={sp}
        extra={[]}
      />
      <div className="mt-3">
        <form className="flex items-end gap-2">
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Date</span>
            <input className="input" type="date" name="date" defaultValue={date}
              max={today()} />
          </label>
          {sp.center && <input type="hidden" name="center" value={sp.center} />}
          <button className="btn btn-ghost mb-[1px] h-[38px]" type="submit">Show</button>
        </form>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title="No staff found" hint="Add teachers and managers first." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Staff</th><th>In</th><th>Out</th><th>Hours</th><th>Location</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.user_id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={r.name} size={32} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{r.name}</div>
                              <div className="truncate text-[12px] text-[var(--muted)]">
                                {ROLE_LABEL[r.role]}{r.center_name ? ` · ${r.center_name}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{time(r.check_in_at)}</td>
                        <td>{time(r.check_out_at)}</td>
                        <td>{minutesToHours(r.worked_minutes)}</td>
                        <td className="text-[13px] text-[var(--muted)]">
                          {r.override_by_name
                            ? <Badge tone="warn">Manual · {r.override_by_name}</Badge>
                            : r.check_in_distance_m == null ? "—"
                            : `${r.check_in_distance_m} m from centre`}
                          {r.override_reason && (
                            <div className="mt-0.5 text-[12px]">{r.override_reason}</div>
                          )}
                        </td>
                        <td>
                          {r.status
                            ? <Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge>
                            : <Badge tone="mute">Not marked</Badge>}
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
          <OverrideForm staff={staffList} date={date} />
        </div>
      </div>
    </>
  );
}
