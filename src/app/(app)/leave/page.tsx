import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { myLeave } from "@/lib/leave";
import { LEAVE_LABEL, LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE, leaveDays } from "@/lib/leave-meta";
import { LeaveForm, WithdrawLeave } from "./LeaveForm";
import { getT } from "@/lib/i18n";

export const metadata = { title: "My leave · Pehchaan" };

export default async function LeavePage() {
  const user = await requireFeature("leave");
  const t = await getT();
  const rows = await myLeave(user.uid);

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title={t("My leave")}
        subtitle={pending > 0
          ? (pending === 1
              ? t("{n} request with the office", { n: pending })
              : t("{n} requests with the office", { n: pending }))
          : t("Ask for time off, and see what was answered")} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title={t("No leave requested yet")}
                hint={t("Anything you ask for appears here with the office's answer.")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{t("Dates")}</th><th>{t("Days")}</th><th>{t("Kind")}</th><th>{t("Reason")}</th>
                      <th>{t("Status")}</th><th>{t("Cover")}</th><th></th>
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
                        <td>{t(LEAVE_LABEL[r.leave_type] ?? r.leave_type)}</td>
                        <td className="max-w-[260px] text-[var(--muted)]">
                          {r.reason}
                          {r.decision_note && (
                            <div className="mt-1 text-[12px]">
                              {t("Office:")} {r.decision_note}
                            </div>
                          )}
                        </td>
                        <td>
                          <Badge tone={LEAVE_STATUS_TONE[r.status]}>
                            {t(LEAVE_STATUS_LABEL[r.status] ?? r.status)}
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
