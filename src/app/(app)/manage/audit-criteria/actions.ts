"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * The checklist, and the weighting behind the award. Super admin only — this is
 * the yardstick every centre is measured against, so changing it changes what
 * "a good centre" means.
 */

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** One per line, blanks dropped — easier to edit than a tag widget. */
const lines = (f: FormData, k: string) =>
  String(f.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

export async function saveCriterion(_prev: unknown, form: FormData) {
  await requireRole("super_admin");

  const id = Number(form.get("id") ?? 0);
  const section = str(form, "section");
  const title = str(form, "title");
  const question = str(form, "question");
  if (!section || !title || !question)
    return { error: "A criterion needs a section, a title and a question." };

  const bands = lines(form, "band_labels");
  if (bands.length !== 0 && bands.length !== 4)
    return { error: "Give four band descriptions — best first — or none at all." };

  const weight = Math.min(5, Math.max(1, Number(form.get("weight") ?? 1) || 1));
  const position = Number(form.get("position") ?? 0) || 0;
  const reasons = lines(form, "reasons");

  if (id) {
    await query(
      `UPDATE audit_criteria
          SET section = $2, title = $3, question = $4, band_labels = $5,
              reasons = $6, weight = $7, position = $8, updated_at = now()
        WHERE id = $1`,
      [id, section, title, question, bands, reasons, weight, position]);
  } else {
    await query(
      `INSERT INTO audit_criteria
         (section, title, question, band_labels, reasons, weight, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [section, title, question, bands, reasons, weight, position]);
  }

  revalidatePath("/manage/audit-criteria");
  return { ok: id ? "Saved." : "Added." };
}

/**
 * Retiring rather than deleting. A criterion that has been scored is part of
 * every report that scored it; removing the row would leave those reports
 * pointing at nothing.
 */
export async function retireCriterion(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const id = Number(form.get("id") ?? 0);
  if (!id) return { error: "Which one?" };
  const on = String(form.get("active") ?? "") === "1";
  await query("UPDATE audit_criteria SET is_active = $2, updated_at = now() WHERE id = $1",
    [id, on]);
  revalidatePath("/manage/audit-criteria");
  return { ok: on ? "Back in use." : "Retired." };
}

export async function saveScoring(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const n = (k: string, lo: number, hi: number, dflt: number) => {
    const v = Number(form.get(k));
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
  };
  await query(
    `UPDATE audit_settings
        SET rating_weight_pct = $1, points_done_well = $2, points_partly = $3,
            points_late = $4, points_not_done = $5, updated_at = now()
      WHERE id`,
    [n("rating_weight_pct", 0, 100, 60), n("points_done_well", 0, 100, 100),
      n("points_partly", 0, 100, 50), n("points_late", 0, 100, 60),
      n("points_not_done", 0, 100, 0)]);
  revalidatePath("/manage/audit-criteria");
  revalidatePath("/audits/board");
  return { ok: "Scoring updated." };
}
