import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { leaveQueue } from "@/lib/leave";
import { LEAVE_LABEL, LEAVE_STATUS_LABEL, LEAVE_STATUS_TONE, leaveDays } from "@/lib/leave-meta";
import DecideForm from "./DecideForm";

export const metadata = { title: "Leave requests · Pehchaan" };

const TABS = [
  { value: "pending", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Refused" },
  { value: "", label: "Everything" },
];

export default async function ManageLeavePage({
  searchParams,
}: { searchParams: Promise<{ status?: string }> }) {
  await requireFeature("leaveApprovals");
  const { status } = await searchParams;
  const filter = status === undefined ? "pending" : status;

  const rows = await leaveQueue(filter || null, null);
  const pending = await leaveQueue("pending", null);
  const onLeaveNow = (await leaveQueue("approved", null)).filter(
    (r) => r.starts_on <= new Date().toISOString().slice(0, 10)
        && r.ends_on >= new Date().toISOString().slice(0, 10));

  return (
    <>
      <PageHeader title="Leave requests"
        subtitle="What teachers have asked for, and what the office answered." />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting approval" value={pending.length}
          hint={pending.length ? "needs an answer" : "nothing waiting"}
          tone={pending.length ? "warn" : "default"} />
        <StatCard label="Away on leave today" value={onLeaveNow.length}
          hint={onLeaveNow.length
            ? `${onLeaveNow.filter((r) => r.backup_name).length} with cover assigned`
            : "everyone is expected in"} />
        <StatCard label="Without cover" value={onLeaveNow.filter((r) => !r.backup_name).length}
          hint="assign a backup teacher"
          tone={onLeaveNow.some((r) => !r.backup_name) ? "warn" : "default"} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.label} href={`/manage/leave?status=${t.value}`}
            className={`btn btn-sm ${filter === t.value ? "btn-primary" : "btn-ghost"}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <Card pad={false}>
        {rows.length === 0 ? (
          <Empty title="Nothing here"
            hint={filter === "pending" ? "Every request has been answered." : "No requests yet."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Staff</th><th>Centre</th><th>Dates</th><th>Days</th><th>Kind</th>
                  <th>Reason</th><th>Cover</th><th>Status</th><th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium whitespace-nowrap">{r.staff_name}</td>
                    <td className="text-[var(--muted)]">{r.center_name ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      {fmtDate(r.starts_on)}
                      {r.ends_on !== r.starts_on && <> – {fmtDate(r.ends_on)}</>}
                    </td>
                    <td>{r.half_day ? "½" : leaveDays(r.starts_on, r.ends_on)}</td>
                    <td>{LEAVE_LABEL[r.leave_type] ?? r.leave_type}</td>
                    <td className="max-w-[240px] text-[var(--muted)]">{r.reason}</td>
                    <td>
                      {r.backup_name
                        ? <Badge tone="ok">{r.backup_name}</Badge>
                        : <Link className="underline text-[13px]" href="/manage/coverage">Assign</Link>}
                    </td>
                    <td>
                      <Badge tone={LEAVE_STATUS_TONE[r.status]}>
                        {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      {r.decided_by_name && (
                        <div className="mt-1 text-[12px] text-[var(--muted)]">
                          by {r.decided_by_name}
                        </div>
                      )}
                    </td>
                    <td className="min-w-[230px]">
                      {r.status === "cancelled"
                        ? <span className="text-[13px] text-[var(--muted)]">Withdrawn</span>
                        : <DecideForm id={r.id} decided={r.status !== "pending"} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
