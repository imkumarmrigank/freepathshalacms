"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { tx } from "@/lib/db";

export type PromotionResult = {
  error?: string;
  ok?: string;
  promoted?: number;
  retained?: number;
  graduated?: number;
  skipped?: number;
};

/**
 * Rolls every active enrolment of `from_session` forward into `to_session`.
 *
 *  · promote  -> next class by sequence (the default)
 *  · retain   -> same class again
 *  · hold     -> left out of the run entirely
 *  · no next class (terminal) -> the student graduates and leaves the roll
 *
 * A student who already has an enrolment in the target session is skipped, so the
 * run is safe to repeat and safe to run per-centre.
 */
export async function runPromotion(_prev: unknown, form: FormData): Promise<PromotionResult> {
  const user = await requireRole("super_admin");
  const fromId = Number(form.get("from_session_id"));
  const toId = Number(form.get("to_session_id"));
  const centerId = form.get("center_id") ? Number(form.get("center_id")) : null;
  const makeCurrent = form.get("make_current") === "on";
  const confirm = String(form.get("confirm") ?? "");

  if (!fromId || !toId) return { error: "Pick both sessions." };
  if (fromId === toId) return { error: "The two sessions must be different." };
  if (confirm !== "PROMOTE") return { error: 'Type PROMOTE in the confirmation box to run this.' };

  try {
    const result = await tx(async (c) => {
      const { rows: sessions } = await c.query<{ id: number; name: string; sequence: number }>(
        "SELECT id, name, sequence FROM academic_sessions WHERE id = ANY($1::bigint[])",
        [[fromId, toId]],
      );
      const from = sessions.find((s) => s.id === fromId);
      const to = sessions.find((s) => s.id === toId);
      if (!from || !to) throw new Error("Session not found.");
      if (to.sequence <= from.sequence)
        throw new Error(`${to.name} does not come after ${from.name}.`);

      const { rows: enrollments } = await c.query<{
        id: number; student_id: number; class_level_id: number; center_id: number;
        section: string | null; promotion_decision: string; class_sequence: number;
      }>(
        `SELECT e.id, e.student_id, e.class_level_id, e.center_id, e.section,
                e.promotion_decision, cl.sequence AS class_sequence
           FROM enrollments e
           JOIN class_levels cl ON cl.id = e.class_level_id
           JOIN students s ON s.id = e.student_id
          WHERE e.session_id = $1 AND e.status = 'active' AND s.status = 'active'
            ${centerId ? "AND e.center_id = $2" : ""}
          ORDER BY cl.sequence`,
        centerId ? [fromId, centerId] : [fromId],
      );

      const { rows: classes } = await c.query<{ id: number; sequence: number }>(
        "SELECT id, sequence FROM class_levels WHERE is_active ORDER BY sequence",
      );

      let promoted = 0, retained = 0, graduated = 0, skipped = 0;

      for (const e of enrollments) {
        if (e.promotion_decision === "hold") { skipped++; continue; }

        const nextClass = e.promotion_decision === "retain"
          ? { id: e.class_level_id }
          : classes.find((cl) => cl.sequence > e.class_sequence);

        if (!nextClass) {
          // Highest class in the ladder — the student completes the programme.
          await c.query("UPDATE students SET status = 'graduated', updated_at = now() WHERE id = $1",
            [e.student_id]);
          await c.query("UPDATE enrollments SET status = 'graduated' WHERE id = $1", [e.id]);
          graduated++;
          continue;
        }

        const ins = await c.query(
          `INSERT INTO enrollments
             (student_id, session_id, class_level_id, center_id, section, enrolled_on, source)
           VALUES ($1,$2,$3,$4,$5, (SELECT start_date FROM academic_sessions WHERE id = $2), $6)
           ON CONFLICT (student_id, session_id) DO NOTHING`,
          [e.student_id, toId, nextClass.id, e.center_id, e.section,
           e.promotion_decision === "retain" ? "retained" : "promoted"],
        );

        if (ins.rowCount === 0) { skipped++; continue; }
        await c.query("UPDATE enrollments SET status = 'completed' WHERE id = $1", [e.id]);
        if (e.promotion_decision === "retain") retained++; else promoted++;
      }

      await c.query(
        `INSERT INTO promotion_runs
           (from_session_id, to_session_id, center_id, promoted_count, retained_count,
            graduated_count, skipped_count, run_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [fromId, toId, centerId, promoted, retained, graduated, skipped, user.uid],
      );

      if (makeCurrent) {
        await c.query("UPDATE academic_sessions SET is_current = FALSE WHERE is_current");
        await c.query("UPDATE academic_sessions SET is_current = TRUE WHERE id = $1", [toId]);
        await c.query("UPDATE academic_sessions SET is_locked = TRUE WHERE id = $1", [fromId]);
      }

      return { promoted, retained, graduated, skipped, from: from.name, to: to.name };
    });

    revalidatePath("/manage/promotions");
    revalidatePath("/students");
    revalidatePath("/dashboard");
    return {
      ok: `${result.from} → ${result.to}: ${result.promoted} promoted, ${result.retained} retained, ` +
          `${result.graduated} graduated, ${result.skipped} skipped.`,
      ...result,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Promotion failed." };
  }
}
