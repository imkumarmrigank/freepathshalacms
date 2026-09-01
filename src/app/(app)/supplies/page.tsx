import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { Alert, Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/format";
import { IssueForm, ItemForm, ReceiptForm } from "./Forms";

export default async function SuppliesPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.role === "teacher")
    return <Alert kind="bad">You don’t have access to supplies.</Alert>;

  const sp = await searchParams;
  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, sp.center) ?? (centers.length === 1 ? centers[0].id : null);
  const isAdmin = user.role === "super_admin";

  const stock = await query<{
    item_id: number; name: string; unit: string; category: string;
    received: string; issued: string;
  }>(
    `SELECT i.id AS item_id, i.name, i.unit, i.category,
            COALESCE((SELECT sum(r.quantity) FROM center_supply_receipts r
                       WHERE r.item_id = i.id ${centerId ? "AND r.center_id = $1" : ""}), 0) AS received,
            COALESCE((SELECT sum(s.quantity) FROM student_supply_issues s
                       WHERE s.item_id = i.id ${centerId ? "AND s.center_id = $1" : ""}), 0) AS issued
       FROM supply_items i
      WHERE i.is_active
      ORDER BY i.category, i.name`,
    centerId ? [centerId] : [],
  );

  const items = stock.map((s) => ({
    id: s.item_id, name: s.name, unit: s.unit,
    available: Number(s.received) - Number(s.issued),
  }));

  const students = centerId
    ? await query<{ id: number; first_name: string; last_name: string | null; enrollment_no: string }>(
        `SELECT id, first_name, last_name, enrollment_no FROM students
          WHERE center_id = $1 AND status = 'active' ORDER BY first_name`,
        [centerId])
    : [];

  const [recentIssues, recentReceipts] = await Promise.all([
    query<{
      id: number; item: string; unit: string; quantity: number; issued_on: string;
      student: string; enrollment_no: string; center_name: string; issued_by: string | null;
    }>(
      `SELECT s.id, i.name AS item, i.unit, s.quantity, s.issued_on,
              st.first_name || ' ' || COALESCE(st.last_name,'') AS student,
              st.enrollment_no, c.name AS center_name, u.name AS issued_by
         FROM student_supply_issues s
         JOIN supply_items i ON i.id = s.item_id
         JOIN students st ON st.id = s.student_id
         JOIN centers c ON c.id = s.center_id
         LEFT JOIN users u ON u.id = s.issued_by
        WHERE 1=1 ${centerId ? "AND s.center_id = $1" : ""}
        ORDER BY s.issued_on DESC, s.id DESC LIMIT 40`,
      centerId ? [centerId] : []),
    query<{
      id: number; item: string; unit: string; quantity: number; received_on: string;
      center_name: string; challan_no: string | null; recorded_by: string | null;
    }>(
      `SELECT r.id, i.name AS item, i.unit, r.quantity, r.received_on, c.name AS center_name,
              r.challan_no, u.name AS recorded_by
         FROM center_supply_receipts r
         JOIN supply_items i ON i.id = r.item_id
         JOIN centers c ON c.id = r.center_id
         LEFT JOIN users u ON u.id = r.recorded_by
        WHERE 1=1 ${centerId ? "AND r.center_id = $1" : ""}
        ORDER BY r.received_on DESC, r.id DESC LIMIT 40`,
      centerId ? [centerId] : []),
  ]);

  const totalIn = items.reduce((n, i) => n + i.available, 0);
  const outOfStock = items.filter((i) => i.available <= 0).length;

  return (
    <>
      <PageHeader title="Supplies"
        subtitle={isAdmin
          ? "Stock sent to centres, and what each centre has handed to students"
          : `Stock at ${user.centerName} and what has been given to students`} />

      {isAdmin && centers.length > 0 && (
        <form className="mb-4 flex items-end gap-2">
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Centre</span>
            <select className="select w-auto" name="center" defaultValue={sp.center ?? ""}>
              <option value="">All centres</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-ghost mb-[1px] h-[38px]" type="submit">Show</button>
        </form>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Items in catalogue" value={items.length} />
        <StatCard label="Units in hand" value={totalIn}
          hint={centerId ? "at this centre" : "across all centres"} />
        <StatCard label="Out of stock" value={outOfStock} hint="items with nothing left"
          tone={outOfStock ? "warn" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card pad={false}>
            <h2 className="px-5 pb-3 pt-5 text-[15px] font-semibold">
              Stock {centerId ? "at this centre" : "across all centres"}
            </h2>
            {stock.length === 0 ? <Empty title="No items in the catalogue yet" /> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Item</th><th>Category</th><th>Received</th><th>Given out</th><th>In hand</th></tr>
                  </thead>
                  <tbody>
                    {stock.map((s) => {
                      const left = Number(s.received) - Number(s.issued);
                      return (
                        <tr key={s.item_id}>
                          <td className="font-medium">{s.name}
                            <span className="ml-1 text-[12px] font-normal text-[var(--faint)]">({s.unit})</span>
                          </td>
                          <td className="text-[var(--muted)]">{titleCase(s.category)}</td>
                          <td className="tabular-nums">{s.received}</td>
                          <td className="tabular-nums">{s.issued}</td>
                          <td>
                            {left <= 0
                              ? <Badge tone="bad">Out of stock</Badge>
                              : <span className="tabular-nums font-medium">{left}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pb-3 pt-5 text-[15px] font-semibold">Given to students</h2>
            {recentIssues.length === 0 ? (
              <Empty title="Nothing handed out yet"
                hint="Record what each student receives so the centre’s stock stays accurate." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Student</th><th>Item</th><th>Qty</th>
                      {!centerId && <th>Centre</th>}<th>By</th></tr>
                  </thead>
                  <tbody>
                    {recentIssues.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDate(r.issued_on)}</td>
                        <td>
                          <div className="font-medium">{r.student.trim()}</div>
                          <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                        </td>
                        <td>{r.item}</td>
                        <td className="tabular-nums">{r.quantity} {r.unit}{r.quantity === 1 ? "" : "s"}</td>
                        {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                        <td className="text-[var(--muted)]">{r.issued_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pb-3 pt-5 text-[15px] font-semibold">Stock received from HQ</h2>
            {recentReceipts.length === 0 ? (
              <Empty title="No stock recorded yet"
                hint={isAdmin ? "Record what you dispatch to each centre."
                  : "Your administrator records what is sent to this centre."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Item</th><th>Qty</th>
                      {!centerId && <th>Centre</th>}<th>Challan</th><th>By</th></tr>
                  </thead>
                  <tbody>
                    {recentReceipts.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDate(r.received_on)}</td>
                        <td className="font-medium">{r.item}</td>
                        <td className="tabular-nums">{r.quantity} {r.unit}{r.quantity === 1 ? "" : "s"}</td>
                        {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                        <td className="text-[var(--muted)]">{r.challan_no ?? "—"}</td>
                        <td className="text-[var(--muted)]">{r.recorded_by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {centerId ? (
            <IssueForm items={items}
              students={students.map((s) => ({
                id: s.id,
                label: `${s.first_name} ${s.last_name ?? ""} · ${s.enrollment_no}`.replace(/\s+/g, " "),
              }))} />
          ) : (
            <Alert kind="info">Pick a centre above to hand items to a student.</Alert>
          )}
          {isAdmin && <ReceiptForm items={items} centers={centers} />}
          {isAdmin && <ItemForm />}
        </div>
      </div>
    </>
  );
}
