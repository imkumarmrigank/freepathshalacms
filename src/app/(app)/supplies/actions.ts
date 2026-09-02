"use server";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser, canTouchCenter } from "@/lib/auth";
import { canManageHqStock } from "@/lib/roles";
import { one, query, tx } from "@/lib/db";
import { currentSession } from "@/lib/queries";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/* ------------------------------------------------------------- catalogue */
export async function saveItem(_prev: unknown, form: FormData) {
  await requireRole("super_admin", "mentor");
  const name = str(form, "name");
  if (!name) return { error: "Name the item." };
  try {
    await query(
      `INSERT INTO supply_items (name, category, unit) VALUES ($1,$2,$3)
       ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, unit = EXCLUDED.unit`,
      [name, String(form.get("category") ?? "stationery"), str(form, "unit") ?? "piece"],
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the item." };
  }
  revalidatePath("/supplies");
  return { ok: `${name} saved.` };
}

/* ------------------------------------------- goods in at headquarters */
export async function recordHqReceipt(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canManageHqStock(user.role))
    return { error: "Only a mentor or the administrator records stock at headquarters." };

  const itemId = Number(form.get("item_id"));
  const quantity = Number(form.get("quantity"));
  if (!itemId) return { error: "Pick an item." };
  if (!Number.isInteger(quantity) || quantity <= 0)
    return { error: "Quantity must be a whole number above zero." };

  const receivedOn = str(form, "received_on") ?? new Date().toISOString().slice(0, 10);
  if (receivedOn > new Date().toISOString().slice(0, 10))
    return { error: "The received date cannot be in the future." };

  await query(
    `INSERT INTO hq_supply_receipts
       (item_id, quantity, received_on, supplier, invoice_no, unit_cost, remarks, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [itemId, quantity, receivedOn, str(form, "supplier"), str(form, "invoice_no"),
     str(form, "unit_cost"), str(form, "remarks"), user.uid],
  );
  revalidatePath("/supplies");
  return { ok: `${quantity} received into headquarters stock.` };
}

/* --------------------------------------------------- HQ -> centre */
export async function recordReceipt(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canManageHqStock(user.role))
    return { error: "Only a mentor or the administrator dispatches stock to a centre." };

  const itemId = Number(form.get("item_id"));
  const centerId = Number(form.get("center_id"));
  const quantity = Number(form.get("quantity"));

  if (!itemId || !centerId) return { error: "Pick an item and a centre." };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };
  if (!Number.isInteger(quantity) || quantity <= 0)
    return { error: "Quantity must be a whole number above zero." };

  const receivedOn = str(form, "received_on") ?? new Date().toISOString().slice(0, 10);
  if (receivedOn > new Date().toISOString().slice(0, 10))
    return { error: "The dispatch date cannot be in the future." };

  try {
    await tx(async (c) => {
      // Lock the ledger for this item so two dispatches cannot both pass the check.
      const { rows } = await c.query<{ received: string; sent: string; item: string; unit: string }>(
        `SELECT
           COALESCE((SELECT sum(quantity) FROM hq_supply_receipts h WHERE h.item_id = $1), 0) AS received,
           COALESCE((SELECT sum(quantity) FROM center_supply_receipts r WHERE r.item_id = $1), 0) AS sent,
           (SELECT name FROM supply_items WHERE id = $1) AS item,
           (SELECT unit FROM supply_items WHERE id = $1) AS unit`,
        [itemId],
      );
      const available = Number(rows[0].received) - Number(rows[0].sent);
      if (quantity > available)
        throw new Error(
          `Headquarters has ${available} ${rows[0].unit}${available === 1 ? "" : "s"} of ` +
          `${rows[0].item} in hand. Record the goods received at headquarters first.`);

      await c.query(
        `INSERT INTO center_supply_receipts
           (item_id, center_id, quantity, received_on, challan_no, unit_cost, remarks,
            recorded_by, dispatched_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [itemId, centerId, quantity, receivedOn, str(form, "challan_no"),
         str(form, "unit_cost"), str(form, "remarks"), user.uid],
      );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record the dispatch." };
  }

  revalidatePath("/supplies");
  return { ok: `${quantity} dispatched to the centre.` };
}

/* ------------------------------- centre -> student (manager or admin) */
export async function issueToStudent(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (user.role === "teacher")
    return { error: "Only the centre manager can hand out supplies." };

  const itemId = Number(form.get("item_id"));
  const studentId = Number(form.get("student_id"));
  const quantity = Number(form.get("quantity"));
  if (!itemId || !studentId) return { error: "Pick an item and a student." };
  if (!Number.isInteger(quantity) || quantity <= 0)
    return { error: "Quantity must be a whole number above zero." };

  const student = await one<{ center_id: number; name: string }>(
    `SELECT center_id, first_name || ' ' || COALESCE(last_name,'') AS name
       FROM students WHERE id = $1`, [studentId]);
  if (!student) return { error: "Student not found." };
  if (user.role !== "super_admin" && student.center_id !== user.centerId)
    return { error: "That student belongs to another centre." };

  const issuedOn = str(form, "issued_on") ?? new Date().toISOString().slice(0, 10);
  if (issuedOn > new Date().toISOString().slice(0, 10))
    return { error: "The issue date cannot be in the future." };

  const session = await currentSession();

  try {
    await tx(async (c) => {
      // Lock the centre's ledger for this item so two issues cannot both pass the check.
      const { rows } = await c.query<{ received: string; issued: string; item: string; unit: string }>(
        `SELECT
           COALESCE((SELECT sum(quantity) FROM center_supply_receipts r
                      WHERE r.item_id = $1 AND r.center_id = $2), 0) AS received,
           COALESCE((SELECT sum(quantity) FROM student_supply_issues i
                      WHERE i.item_id = $1 AND i.center_id = $2), 0) AS issued,
           (SELECT name FROM supply_items WHERE id = $1) AS item,
           (SELECT unit FROM supply_items WHERE id = $1) AS unit`,
        [itemId, student.center_id],
      );
      const available = Number(rows[0].received) - Number(rows[0].issued);
      if (quantity > available)
        throw new Error(
          `Only ${available} ${rows[0].unit}${available === 1 ? "" : "s"} of ` +
          `${rows[0].item} left at this centre.`);

      await c.query(
        `INSERT INTO student_supply_issues
           (item_id, center_id, student_id, session_id, quantity, issued_on, remarks, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [itemId, student.center_id, studentId, session?.id ?? null, quantity,
         issuedOn, str(form, "remarks"), user.uid],
      );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not record the issue." };
  }

  revalidatePath("/supplies");
  return { ok: `Issued to ${student.name.trim()}.` };
}
