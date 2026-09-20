"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { can } from "@/lib/roles";
import { isTopic } from "@/lib/centre-feedback-meta";
import { today } from "@/lib/format";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** The mentor's own account of a centre. / मेंटर का केंद्र पर फ़ीडबैक। */
export async function giveCentreFeedback(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  if (!can(user.role, "centreFeedback"))
    return { error: "Centre feedback is the mentor's to give." };

  const centerId = Number(form.get("center_id"));
  if (!centerId) return { error: "Choose the centre. / केंद्र चुनें।" };

  const visitedOn = str(form, "visited_on") ?? today();
  if (visitedOn > today())
    return { error: "The visit cannot be dated in the future. / तिथि आगे की नहीं हो सकती।" };

  const ratingRaw = form.get("rating");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating !== null && (rating < 1 || rating > 5))
    return { error: "Rate the centre from 1 to 5." };

  const topics = form.getAll("topics").map(String).filter(isTopic);
  const workingWell = str(form, "working_well");
  const needsAttention = str(form, "needs_attention");

  // Feedback with nothing written in it tells the office nothing at all.
  if (!workingWell && !needsAttention)
    return {
      error: "Write at least one of the two notes. / "
           + "दोनों में से कम से कम एक बात ज़रूर लिखें।",
    };

  const language = String(form.get("language") ?? "en") === "hi" ? "hi" : "en";
  const session = await currentSession();

  await query(
    `INSERT INTO centre_feedback
       (center_id, mentor_id, session_id, visited_on, rating, topics,
        working_well, needs_attention, parent_voice, urgent, share_with_centre, language)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [centerId, user.uid, session?.id ?? null, visitedOn, rating, topics,
     workingWell, needsAttention, str(form, "parent_voice"),
     form.get("urgent") === "on", form.get("share_with_centre") === "on", language],
  );

  revalidatePath("/centre-feedback");
  return { ok: "Feedback saved. / फ़ीडबैक सहेज लिया गया।" };
}
