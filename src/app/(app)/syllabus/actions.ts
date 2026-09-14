"use server";
import { revalidatePath } from "next/cache";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { today } from "@/lib/format";
import { canEditSyllabus, canMarkSyllabus } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Which centre this person is recording progress for. */
async function centreFor(form: FormData, user: Awaited<ReturnType<typeof requireUser>>) {
  const asked = Number(form.get("center_id")) || null;
  const centerId = canEditSyllabus(user.role) ? asked : (user.centerId ?? asked);
  if (!centerId) return null;
  return canTouchCenter(user, centerId) ? centerId : null;
}

/* ------------------------------------------------- what a centre has taught */

/** A teacher ticking one line of the month off. */
export async function tickItem(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canMarkSyllabus(user.role) && !canEditSyllabus(user.role))
    return { error: "Only the centre's own staff record progress." };

  const itemId = Number(form.get("item_id"));
  const on = String(form.get("done") ?? "") === "1";
  const centerId = await centreFor(form, user);
  if (!itemId || !centerId) return { error: "Which line, and for which centre?" };

  if (on) {
    await query(
      `INSERT INTO syllabus_item_ticks (item_id, center_id, done_on, marked_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (item_id, center_id) DO UPDATE SET done_on = EXCLUDED.done_on,
         marked_by = EXCLUDED.marked_by`,
      [itemId, centerId, today(), user.uid]);
  } else {
    await query("DELETE FROM syllabus_item_ticks WHERE item_id = $1 AND center_id = $2",
      [itemId, centerId]);
  }

  const unit = await one<{ unit_id: number }>(
    "SELECT unit_id FROM syllabus_items WHERE id = $1", [itemId]);
  if (unit) revalidatePath(`/syllabus/${unit.unit_id}`);
  return { ok: "Saved." };
}

/** The monthly mark: this centre has finished this month, or is working on it. */
export async function markMonth(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canMarkSyllabus(user.role) && !canEditSyllabus(user.role))
    return { error: "Only the centre's own staff record progress." };

  const unitId = Number(form.get("unit_id"));
  const status = String(form.get("status") ?? "");
  const centerId = await centreFor(form, user);
  if (!unitId || !centerId) return { error: "Which month, and for which centre?" };
  if (!["not_started", "in_progress", "completed"].includes(status))
    return { error: "Pick where this month stands." };

  await query(
    `INSERT INTO syllabus_progress
       (unit_id, center_id, status, completed_on, remarks, marked_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (unit_id, center_id) DO UPDATE
       SET status = EXCLUDED.status, completed_on = EXCLUDED.completed_on,
           remarks = EXCLUDED.remarks, marked_by = EXCLUDED.marked_by, updated_at = now()`,
    [unitId, centerId, status,
     status === "completed" ? (str(form, "completed_on") ?? today()) : null,
     str(form, "remarks"), user.uid]);

  revalidatePath(`/syllabus/${unitId}`);
  revalidatePath("/syllabus");
  return { ok: status === "completed" ? "Marked complete." : "Saved." };
}

/* --------------------------------------------------- setting the syllabus */

export async function saveUnit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canEditSyllabus(user.role))
    return { error: "Only an admin or super admin sets the syllabus." };

  const id = Number(form.get("unit_id")) || 0;
  const sessionId = Number(form.get("session_id"));
  const classId = Number(form.get("class_level_id"));
  const subject = str(form, "subject");
  const monthNo = Number(form.get("month_no"));

  // an edit already knows its class and session; only a new month needs them
  if (!subject) return { error: "The subject is required." };
  if (!id && (!sessionId || !classId))
    return { error: "Session and class are required." };
  if (!Number.isInteger(monthNo) || monthNo < 1 || monthNo > 12)
    return { error: "The month must be between 1 and 12." };

  if (id) {
    await query(
      `UPDATE syllabus_units SET subject=$2, month_no=$3, heading=$4, outcome=$5, updated_at=now()
        WHERE id=$1`,
      [id, subject, monthNo, str(form, "heading"), str(form, "outcome")]);
  } else {
    const clash = await one<{ id: number }>(
      `SELECT id FROM syllabus_units
        WHERE session_id=$1 AND class_level_id=$2 AND subject=$3 AND month_no=$4`,
      [sessionId, classId, subject, monthNo]);
    if (clash) return { error: `Month ${monthNo} of ${subject} is already set for this class.` };
    await query(
      `INSERT INTO syllabus_units
         (session_id, class_level_id, subject, month_no, heading, outcome, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [sessionId, classId, subject, monthNo, str(form, "heading"), str(form, "outcome"), user.uid]);
  }
  revalidatePath("/manage/syllabus");
  revalidatePath("/syllabus");
  return { ok: id ? "Saved." : "Month added." };
}

/** The lines of a month, edited as one block of text — one line each. */
export async function saveItems(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canEditSyllabus(user.role))
    return { error: "Only an admin or super admin sets the syllabus." };

  const unitId = Number(form.get("unit_id"));
  if (!unitId) return { error: "Which month?" };
  const lines = String(form.get("items") ?? "")
    .split("\n").map((l) => l.trim()).filter(Boolean);

  // Ticks are keyed to an item, so rewriting the list would drop every centre's
  // progress. Lines that are unchanged keep their row, and their ticks with it.
  const existing = await query<{ id: number; text: string }>(
    "SELECT id, text FROM syllabus_items WHERE unit_id = $1 ORDER BY position, id", [unitId]);
  const byText = new Map(existing.map((e) => [e.text, e.id]));
  const keep: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const found = byText.get(lines[i]);
    if (found !== undefined) {
      await query("UPDATE syllabus_items SET position = $2 WHERE id = $1", [found, i + 1]);
      keep.push(found);
      byText.delete(lines[i]);
    } else {
      const row = await one<{ id: number }>(
        "INSERT INTO syllabus_items (unit_id, position, text) VALUES ($1,$2,$3) RETURNING id",
        [unitId, i + 1, lines[i]]);
      if (row) keep.push(row.id);
    }
  }
  const gone = existing.filter((e) => !keep.includes(e.id)).map((e) => e.id);
  if (gone.length) await query("DELETE FROM syllabus_items WHERE id = ANY($1)", [gone]);

  revalidatePath("/manage/syllabus");
  revalidatePath(`/syllabus/${unitId}`);
  return { ok: `Saved ${lines.length} line${lines.length === 1 ? "" : "s"}.` };
}

export async function deleteUnit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canEditSyllabus(user.role))
    return { error: "Only an admin or super admin sets the syllabus." };
  const id = Number(form.get("unit_id"));
  if (!id) return { error: "Which month?" };

  const taught = await one<{ n: string }>(
    "SELECT count(*) AS n FROM syllabus_progress WHERE unit_id = $1 AND status <> 'not_started'",
    [id]);
  if (Number(taught?.n ?? 0) > 0)
    return { error: `${taught!.n} centre(s) have already recorded work against this month. Clear their progress first, or edit it rather than removing it.` };

  await query("DELETE FROM syllabus_units WHERE id = $1", [id]);
  revalidatePath("/manage/syllabus");
  revalidatePath("/syllabus");
  return { ok: "Month removed." };
}
