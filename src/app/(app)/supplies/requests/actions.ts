"use server";
import { revalidatePath } from "next/cache";
import { today } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { canManageHqStock, isGlobalRole } from "@/lib/roles";
import { one, query, tx } from "@/lib/db";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function ensureSupplyRequestsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS supply_requests (
      id            SERIAL PRIMARY KEY,
      center_id     INTEGER NOT NULL REFERENCES centers(id),
      item_id       INTEGER NOT NULL REFERENCES supply_items(id),
      quantity      INTEGER NOT NULL,
      reason        TEXT,
      requested_by  INTEGER NOT NULL REFERENCES users(id),
      requested_on  DATE NOT NULL DEFAULT CURRENT_DATE,
      status        TEXT NOT NULL DEFAULT 'pending',
      notes         TEXT,
      handled_by    INTEGER REFERENCES users(id),
      handled_on    DATE,
      receipt_id    INTEGER REFERENCES center_supply_receipts(id)
    )
  `);
}

/** Any centre-based user can submit a supply request. */
export async function submitSupplyRequest(_prev: unknown, form: FormData) {
  const user = await requireUser();
  // Global roles (admin/super_admin/mentor/auditor) don't belong to a centre
  if (isGlobalRole(user.role))
    return { error: "Only centre staff can submit supply requests." };
  if (!user.centerId)
    return { error: "Your account is not assigned to a centre." };

  const itemId = Number(form.get("item_id"));
  const quantity = Number(form.get("quantity"));
  if (!itemId) return { error: "Pick an item." };
  if (!Number.isInteger(quantity) || quantity <= 0)
    return { error: "Quantity must be a whole number above zero." };

  await ensureSupplyRequestsTable();
  await query(
    `INSERT INTO supply_requests (center_id, item_id, quantity, reason, requested_by, requested_on)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [user.centerId, itemId, quantity, str(form, "reason"), user.uid, today()],
  );
  revalidatePath("/supplies/requests");
  return { ok: "Request submitted." };
}

/** Admin/super_admin can dispatch (fulfil) a pending request. */
export async function dispatchRequest(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canManageHqStock(user.role))
    return { error: "Only an administrator can dispatch supply requests." };

  const requestId = Number(form.get("request_id"));
  const quantity = Number(form.get("quantity"));
  if (!requestId) return { error: "Invalid request." };
  if (!Number.isInteger(quantity) || quantity <= 0)
    return { error: "Quantity must be a whole number above zero." };

  const req = await one<{ id: number; center_id: number; item_id: number; status: string }>(
    `SELECT id, center_id, item_id, status FROM supply_requests WHERE id = $1`, [requestId],
  );
  if (!req) return { error: "Request not found." };
  if (req.status !== "pending") return { error: "This request has already been handled." };

  try {
    await tx(async (c) => {
      // Check HQ stock
      const { rows } = await c.query<{ received: string; sent: string; item: string; unit: string }>(
        `SELECT
           COALESCE((SELECT sum(quantity) FROM hq_supply_receipts h WHERE h.item_id = $1), 0) AS received,
           COALESCE((SELECT sum(quantity) FROM center_supply_receipts r WHERE r.item_id = $1), 0) AS sent,
           (SELECT name FROM supply_items WHERE id = $1) AS item,
           (SELECT unit FROM supply_items WHERE id = $1) AS unit`,
        [req.item_id],
      );
      const available = Number(rows[0].received) - Number(rows[0].sent);
      if (quantity > available)
        throw new Error(
          `HQ has ${available} ${rows[0].unit}${available === 1 ? "" : "s"} of ${rows[0].item} in hand.`,
        );

      // Create the centre receipt
      const { rows: [receipt] } = await c.query<{ id: number }>(
        `INSERT INTO center_supply_receipts
           (item_id, center_id, quantity, received_on, challan_no, remarks, recorded_by, dispatched_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
         RETURNING id`,
        [req.item_id, req.center_id, quantity, today(),
         str(form, "challan_no"), str(form, "notes"), user.uid],
      );

      // Mark request as dispatched
      await c.query(
        `UPDATE supply_requests
            SET status = 'dispatched', notes = $1, handled_by = $2, handled_on = $3, receipt_id = $4
          WHERE id = $5`,
        [str(form, "notes"), user.uid, today(), receipt.id, requestId],
      );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not dispatch." };
  }

  revalidatePath("/supplies/requests");
  revalidatePath("/supplies");
  return { ok: "Dispatched and stock recorded." };
}

/** Admin/super_admin can reject a pending request. */
export async function rejectRequest(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canManageHqStock(user.role))
    return { error: "Only an administrator can reject supply requests." };

  const requestId = Number(form.get("request_id"));
  const req = await one<{ status: string }>(
    `SELECT status FROM supply_requests WHERE id = $1`, [requestId],
  );
  if (!req) return { error: "Request not found." };
  if (req.status !== "pending") return { error: "This request has already been handled." };

  await query(
    `UPDATE supply_requests
        SET status = 'rejected', notes = $1, handled_by = $2, handled_on = $3
      WHERE id = $4`,
    [str(form, "notes"), user.uid, today(), requestId],
  );
  revalidatePath("/supplies/requests");
  return { ok: "Request rejected." };
}
