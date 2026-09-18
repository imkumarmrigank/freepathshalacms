import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { myLeave } from "@/lib/leave";
import { LEAVE_LABEL, LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE, leaveDays } from "@/lib/leave-meta";
import { LeaveForm, WithdrawLeave } from "./LeaveForm";

export const metadata = { title: "My leave · Pehchaan" };

export default async function LeavePage() {
  const user = await requireFeature("leave");
  const rows = await myLeave(user.uid);

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title="My leave"
        subtitle={pending > 0
          ? `${pending} request${pending === 1 ? "" : "s"} with the office`
          : "Ask for time off, and see what was answered"} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title="No leave requested yet"
                hint="Anything you ask for appears here with the office's answer." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Dates</th><th>Days</th><th>Kind</th><th>Reason</th>
                      <th>Status</th><th>Cover</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium whitespace-nowrap">
                          {fmtDate(r.starts_on)}
                          {r.ends_on !== r.starts_on && <> – {fmtDate(r.ends_on)}</>}
                        </td>
                        <td>{r.half_day ? "½" : leaveDays(r.starts_on, r.ends_on)}</td>
                        <td>{LEAVE_LABEL[r.leave_type] ?? r.leave_type}</td>
                        <td className="max-w-[260px] text-[var(--muted)]">
                          {r.reason}
                          {r.decision_note && (
                            <div className="mt-1 text-[12px]">
                              Office: {r.decision_note}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge tone={LEAVE_STATUS_TONE[r.status]}>
                            {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </td>
                        <td className="text-[var(--muted)]">{r.backup_name ?? "—"}</td>
                        <td>{r.status === "pending" && <WithdrawLeave id={r.id} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <LeaveForm />
        </div>
      </div>
    </>
  );
}
