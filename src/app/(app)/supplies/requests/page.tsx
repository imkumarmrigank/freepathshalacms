import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { canManageHqStock, isGlobalRole } from "@/lib/roles";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { ensureSupplyRequestsTable } from "./actions";
import { RequestForm, DispatchForm } from "./RequestForm";

export const metadata = { title: "Supply requests · FreePathshala" };

const STATUS_TONE: Record<string, string> = {
  pending: "warn", dispatched: "ok", rejected: "bad",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", dispatched: "Dispatched", rejected: "Rejected",
};

export default async function SupplyRequestsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();

  // Global roles without a centre (mentor, auditor) don't use this page
  if (user.role === "auditor" || user.role === "rider")
    redirect("/dashboard");

  await ensureSupplyRequestsTable();

  const isAdmin = canManageHqStock(user.role);
  const sp = await searchParams;
  const statusFilter = sp.status ?? "pending";

  const pg = pageFrom(sp, 20);

  // Items catalogue for the request form
  const items = isGlobalRole(user.role)
    ? []
    : await query<{ id: number; name: string; unit: string; category: string }>(
        `SELECT id, name, unit, category FROM supply_items WHERE is_active ORDER BY category, name`,
      );

  const rows = await query<{
    id: number; item: string; unit: string; quantity: number;
    reason: string | null; requested_on: string; status: string;
    center_name: string; requester: string;
    notes: string | null; handled_on: string | null; handler: string | null;
    total_rows: string;
  }>(
    `SELECT count(*) OVER () AS total_rows,
            sr.id, i.name AS item, i.unit, sr.quantity, sr.reason,
            sr.requested_on, sr.status,
            c.name AS center_name,
            u.name AS requester,
            sr.notes, sr.handled_on,
            h.name AS handler
       FROM supply_requests sr
       JOIN supply_items i ON i.id = sr.item_id
       JOIN centers c ON c.id = sr.center_id
       JOIN users u ON u.id = sr.requested_by
       LEFT JOIN users h ON h.id = sr.handled_by
      WHERE ($1::text = 'all' OR sr.status = $1)
        ${user.centerId ? "AND sr.center_id = $3" : ""}
      ORDER BY sr.requested_on DESC, sr.id DESC
      LIMIT ${user.centerId ? "$4" : "$2"} OFFSET ${user.centerId ? "$5" : "$3"}`,
    user.centerId
      ? [statusFilter, pg.size, user.centerId, pg.size, pg.offset]
      : [statusFilter, pg.size, pg.offset],
  );

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);

  const pendingCount = isAdmin
    ? await query<{ n: string }>(`SELECT count(*) AS n FROM supply_requests WHERE status = 'pending'`)
        .then((r) => Number(r[0]?.n ?? 0))
    : 0;

  return (
    <>
      <PageHeader
        title="Supply requests"
        subtitle={isAdmin
          ? "Requests from centres — dispatch or reject them here"
          : "Request supplies from headquarters and track their status"}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Status filter tabs */}
          <div className="flex flex-wrap gap-2 text-[13px]">
            {[["pending", "Pending"], ["dispatched", "Dispatched"], ["rejected", "Rejected"], ["all", "All"]].map(([val, label]) => (
              <a key={val}
                href={`?status=${val}`}
                className={`rounded-[8px] border px-3 py-1.5 transition-colors ${
                  statusFilter === val
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[var(--border)] hover:bg-[#fafafd]"
                }`}>
                {label}
                {val === "pending" && isAdmin && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--warn)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {pendingCount}
                  </span>
                )}
              </a>
            ))}
          </div>

          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title={`No ${statusFilter === "all" ? "" : statusFilter} requests`}
                hint={isAdmin
                  ? "Requests submitted by centres will appear here."
                  : "Submit a request using the form on the right."} />
            ) : (
              <ul>
                {rows.map((r) => (
                  <li key={r.id} className="border-t border-[#f1f1f6] first:border-0">
                    <div className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium">{r.item}</span>
                        <span className="text-[13px] text-[var(--muted)]">
                          × {r.quantity} {r.unit}{r.quantity === 1 ? "" : "s"}
                        </span>
                        <Badge tone={STATUS_TONE[r.status] ?? "mute"}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-[12.5px] text-[var(--muted)]">
                        {isAdmin && <span className="font-medium text-[var(--text)]">{r.center_name}</span>}
                        <span>by {r.requester}</span>
                        <span>{fmtDate(r.requested_on)}</span>
                      </div>
                      {r.reason && (
                        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                          Reason: {r.reason}
                        </p>
                      )}
                      {r.status !== "pending" && (
                        <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                          {STATUS_LABEL[r.status]} on {r.handled_on ? fmtDate(r.handled_on) : "—"}
                          {r.handler ? ` by ${r.handler}` : ""}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </p>
                      )}
                      {/* Dispatch/reject controls for admin on pending requests */}
                      {isAdmin && r.status === "pending" && (
                        <DispatchForm req={r} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Pager page={pg.page} pages={win.pages} first={win.first}
              last={win.last} total={total} unit="request" />
          </Card>
        </div>

        {/* Request form — only for centre-based users */}
        <div>
          {!isGlobalRole(user.role) && user.centerId ? (
            <RequestForm items={items} />
          ) : (
            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 text-[13px] text-[var(--muted)]">
              Dispatch or reject pending requests from the list on the left.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
