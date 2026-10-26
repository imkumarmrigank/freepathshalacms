"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canTouchCenter, requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { can } from "@/lib/roles";
import { ASSESSMENT_PARAMS, MIN_RATED, consolidate, type Ratings } from "@/lib/centre-feedback-meta";
import { today } from "@/lib/format";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/**
 * The mentor's account of a centre visit. "Save as draft" keeps it for later;
 * "Submit" sends it to the office. / मेंटर का केंद्र पर फ़ीडबैक।
 */
export async function giveCentreFeedback(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  if (!can(user.role, "centreFeedback"))
    return { error: "Centre feedback is the mentor's to give." };

  const submitting = String(form.get("intent") ?? "submit") !== "draft";

  const centerId = Number(form.get("center_id"));
  if (!centerId) return { error: "Choose the centre. / केंद्र चुनें।" };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };

  const visitedOn = str(form, "visited_on") ?? today();
  if (visitedOn > today())
    return { error: "The visit cannot be dated in the future. / तिथि आगे की नहीं हो सकती।" };

  // 3 = good, 2 = average, 1 = below average, 0 = not observed
  const ratings: Ratings = {};
  for (const p of ASSESSMENT_PARAMS) {
    const raw = str(form, `rating_${p.key}`);
    if (raw === null) continue;
    const v = Number(raw);
    if (![0, 1, 2, 3].includes(v)) return { error: "Choose Good, Average or Below Avg." };
    ratings[p.key] = v;
  }
  const result = consolidate(ratings);

  const workingWell = str(form, "working_well");
  const needsAttention = str(form, "needs_attention");

  if (submitting) {
    if (result.rated < MIN_RATED)
      return {
        error: `Rate at least ${MIN_RATED} of the 6 parameters before submitting. / `
             + `जमा करने से पहले कम से कम ${MIN_RATED} बिंदुओं पर रेटिंग दें।`,
      };
    if (!workingWell && !needsAttention)
      return {
        error: "Write at least one of the two observations. / "
             + "दोनों में से कम से कम एक अवलोकन ज़रूर लिखें।",
      };
  }

  const session = await currentSession();
  const status = submitting ? "submitted" : "draft";
  const values = [
    centerId, visitedOn, JSON.stringify(ratings),
    result.score === null ? null : Math.round(result.score * 100) / 100,
    workingWell, needsAttention, str(form, "parent_voice"), status,
  ];

  const draftId = Number(form.get("draft_id")) || 0;
  if (draftId) {
    // finishing a draft the mentor started: only their own, and only while still a draft
    const mine = await one<{ id: number }>(
      "SELECT id FROM centre_feedback WHERE id = $1 AND mentor_id = $2 AND status = 'draft'",
      [draftId, user.uid]);
    if (!mine) return { error: "That draft could not be found." };
    await query(
      `UPDATE centre_feedback
          SET center_id = $2, visited_on = $3, ratings = $4, overall_score = $5,
              working_well = $6, needs_attention = $7, parent_voice = $8, status = $9
        WHERE id = $1`,
      [draftId, ...values]);
  } else {
    await query(
      `INSERT INTO centre_feedback
         (mentor_id, session_id, center_id, visited_on, ratings, overall_score,
          working_well, needs_attention, parent_voice, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [user.uid, session?.id ?? null, ...values]);
  }

  revalidatePath("/centre-feedback");
  redirect(`/centre-feedback?done=${status}`);
}
