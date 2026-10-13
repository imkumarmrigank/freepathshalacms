import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser } from "@/lib/queries";
import { Alert, Card, PageHeader } from "@/components/ui";
import Link from "next/link";
import DistributeForm from "./DistributeForm";

export default async function DistributePage() {
  const user = await requireRole("super_admin", "admin");

  const [centers, items, allStudents] = await Promise.all([
    centersForUser(user),
    query<{ id: number; name: string; unit: string; available: number }>(
      `SELECT i.id, i.name, i.unit,
              COALESCE((SELECT sum(r.quantity) FROM center_supply_receipts r
                         WHERE r.item_id = i.id), 0)
            - COALESCE((SELECT sum(s.quantity) FROM student_supply_issues s
                         WHERE s.item_id = i.id), 0) AS available
         FROM supply_items i
        WHERE i.is_active
        ORDER BY i.category, i.name`,
    ),
    query<{ id: number; first_name: string; last_name: string | null;
             enrollment_no: string; center_id: number }>(
      `SELECT id, first_name, last_name, enrollment_no, center_id
         FROM students WHERE status = 'active' ORDER BY first_name`,
    ),
  ]);

  const formStudents = allStudents.map((s) => ({
    id: s.id,
    center_id: s.center_id,
    label: `${s.first_name} ${s.last_name ?? ""} · ${s.enrollment_no}`.replace(/\s+/g, " "),
  }));

  return (
    <>
      <PageHeader
        title="Distribute supplies to students"
        subtitle="Select a centre, pick students, enter item quantities and submit."
        right={
          <Link href="/supplies" className="btn btn-ghost">Back to stock</Link>
        }
      />

      {items.length === 0 ? (
        <Alert kind="info">
          No items in the catalogue yet.{" "}
          <Link href="/supplies" className="underline">Add items</Link> first.
        </Alert>
      ) : (
        <div className="mx-auto max-w-2xl">
          <DistributeForm centers={centers} allStudents={formStudents} items={items} />
        </div>
      )}
    </>
  );
}
