"use server";
import { revalidatePath } from "next/cache";
import { today } from "@/lib/format";
import { redirect } from "next/navigation";
import { requireUser, canTouchCenter, effectiveTeacherIds } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { PLAN_LEAD_DAYS, earliestPlanStart } from "@/lib/plan-meta";
import { isGlobalRole, isTeaching } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** The plan plus who is allowed to touch it. */
async function loadPlan(planId: number) {
  return one<{
    id: number; teacher_id: number; center_id: number; class_level_id: number;
  }>("SELECT id, teacher_id, center_id, class_level_id FROM teaching_plans WHERE id = $1", [planId]);
}

async function canEditPlan(planId: number) {
  const user = await requireUser();
  const plan = await loadPlan(planId);
  if (!plan) return { error: "Plan not found." } as const;
  if (isTeaching(user.role) && plan.teacher_id !== user.uid)
    return { error: "This plan belongs to another teacher." } as const;
  if (!canTouchCenter(user, plan.center_id))
    return { error: "This plan belongs to another centre." } as const;
  return { user, plan } as const;
}

export async function createPlan(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const classLevelId = Number(form.get("class_level_id"));
  const title = str(form, "title");
  if (!classLevelId || !title) return { error: "Give the plan a title and a class." };

  const startsOn = str(form, "starts_on");
  if (!startsOn) return { error: "Set the date this plan starts." };
  const earliest = earliestPlanStart();
  if (startsOn < earliest)
    return {
      error: `A plan must be submitted at least ${PLAN_LEAD_DAYS} days before it starts. ` +
             `The earliest start you can pick today is ${earliest}.`,
    };
  const endsOn = str(form, "ends_on");
  if (endsOn && endsOn < startsOn) return { error: "The end date cannot be before the start." };

  // Teachers may only plan for a class they are allotted.
  let teacherId = user.uid;
  let centerId = user.centerId;
  if (isTeaching(user.role)) {
    const allotted = await one<{ id: number }>(
      `SELECT id FROM teacher_classes
        WHERE user_id = ANY($1::bigint[]) AND session_id = $2 AND class_level_id = $3`,
      [effectiveTeacherIds(user), session.id, classLevelId],
    );
    if (!allotted)
      return { error: "You are not allotted to this class. Ask your centre manager." };
  } else {
    const chosen = form.get("teacher_id") ? Number(form.get("teacher_id")) : null;
    if (chosen) {
      const t = await one<{ center_id: number | null }>(
        "SELECT center_id FROM users WHERE id = $1", [chosen]);
      if (!t) return { error: "Teacher not found." };
      teacherId = chosen;
      centerId = t.center_id;
    }
    if (isGlobalRole(user.role) && form.get("center_id"))
      centerId = Number(form.get("center_id"));
  }
  if (!centerId) return { error: "Pick a centre for this plan." };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };

  const row = await one<{ id: number }>(
    `INSERT INTO teaching_plans
       (title, subject, center_id, session_id, class_level_id, teacher_id,
        description, starts_on, ends_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [title, str(form, "subject"), centerId, session.id, classLevelId, teacherId,
     str(form, "description"), str(form, "starts_on"), str(form, "ends_on")],
  );

  revalidatePath("/teaching-plans");
  redirect(`/teaching-plans/${row!.id}`);
}

/**
 * Hands the plan to the centre manager. Allowed only while there are still
 * PLAN_LEAD_DAYS days before the plan starts.
 */
export async function submitPlan(_prev: unknown, form: FormData) {
  const planId = Number(form.get("plan_id"));
  const guard = await canEditPlan(planId);
  if ("error" in guard) return guard;

  const plan = await one<{ starts_on: string | null; status: string; topics: string }>(
    `SELECT p.starts_on, p.status,
            (SELECT count(*) FROM teaching_plan_topics t WHERE t.plan_id = p.id) AS topics
       FROM teaching_plans p WHERE p.id = $1`,
    [planId],
  );
  if (!plan) return { error: "Plan not found." };
  if (plan.status !== "draft") return { error: "This plan has already been submitted." };
  if (Number(plan.topics) === 0)
    return { error: "Add at least one topic before submitting." };
  if (!plan.starts_on) return { error: "Set the plan's start date first." };
  if (plan.starts_on < earliestPlanStart())
    return {
      error: `This plan starts on ${plan.starts_on}, which is less than ${PLAN_LEAD_DAYS} days away. ` +
             "It is too late to submit it — ask your centre manager how to proceed.",
    };

  await query(
    `UPDATE teaching_plans SET status = 'submitted', submitted_at = now(), submitted_by = $2
      WHERE id = $1`,
    [planId, guard.user.uid],
  );
  revalidatePath("/teaching-plans");
  revalidatePath(`/teaching-plans/${planId}`);
  return { ok: "Plan submitted to your centre manager." };
}

export async function addTopic(_prev: unknown, form: FormData) {
  const planId = Number(form.get("plan_id"));
  const guard = await canEditPlan(planId);
  if ("error" in guard) return guard;

  const topic = str(form, "topic");
  if (!topic) return { error: "Name the topic." };

  const next = await one<{ n: string }>(
    "SELECT COALESCE(max(sequence), 0) + 1 AS n FROM teaching_plan_topics WHERE plan_id = $1",
    [planId],
  );

  await query(
    `INSERT INTO teaching_plan_topics (plan_id, sequence, topic, objective, planned_date)
     VALUES ($1,$2,$3,$4,$5)`,
    [planId, Number(next!.n), topic, str(form, "objective"), str(form, "planned_date")],
  );
  revalidatePath(`/teaching-plans/${planId}`);
  return { ok: "Topic added." };
}

/** Mark a topic taught, with the remarks, aids used and problems hit. */
export async function completeTopic(_prev: unknown, form: FormData) {
  const topicId = Number(form.get("topic_id"));
  const row = await one<{ plan_id: number }>(
    "SELECT plan_id FROM teaching_plan_topics WHERE id = $1", [topicId]);
  if (!row) return { error: "Topic not found." };

  const guard = await canEditPlan(row.plan_id);
  if ("error" in guard) return guard;

  const status = String(form.get("status") ?? "completed");
  const taughtOn = str(form, "taught_on");
  if (status === "completed" && !taughtOn)
    return { error: "Enter the date this topic was taught." };
  if (taughtOn && taughtOn > today())
    return { error: "A topic cannot be marked taught on a future date." };

  await query(
    `UPDATE teaching_plan_topics
        SET status = $2,
            taught_on = $3,
            taught_by = CASE WHEN $2 = 'completed' THEN $4 ELSE taught_by END,
            remarks = $5, resources_used = $6, issues_faced = $7,
            completed_at = CASE WHEN $2 = 'completed' THEN now() ELSE NULL END
      WHERE id = $1`,
    [topicId, status, status === "completed" ? taughtOn : null, guard.user.uid,
     str(form, "remarks"), str(form, "resources_used"), str(form, "issues_faced")],
  );

  revalidatePath(`/teaching-plans/${row.plan_id}`);
  return { ok: status === "completed" ? "Topic marked taught." : "Topic updated." };
}

export async function deleteTopic(_prev: unknown, form: FormData) {
  const topicId = Number(form.get("topic_id"));
  const row = await one<{ plan_id: number }>(
    "SELECT plan_id FROM teaching_plan_topics WHERE id = $1", [topicId]);
  if (!row) return { error: "Topic not found." };
  const guard = await canEditPlan(row.plan_id);
  if ("error" in guard) return guard;

  await query("DELETE FROM teaching_plan_topics WHERE id = $1", [topicId]);
  revalidatePath(`/teaching-plans/${row.plan_id}`);
  return { ok: "Topic removed." };
}

/* --------------------------------------------- teacher -> class allocation */
export async function setAllocation(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (isTeaching(user.role)) return { error: "Only managers can allot classes." };
  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const teacherId = Number(form.get("user_id"));
  const teacher = await one<{ center_id: number | null }>(
    "SELECT center_id FROM users WHERE id = $1", [teacherId]);
  if (!teacher) return { error: "Teacher not found." };
  // say the accurate thing first: somebody with no centre at all — a backup
  // teacher, say — is not "at another centre", they simply have none yet
  if (!teacher.center_id) return { error: "Assign the teacher to a centre first." };
  if (!canTouchCenter(user, teacher.center_id))
    return { error: "That teacher is not at your centre." };

  const classIds = form.getAll("class_level_id").map(Number).filter(Boolean);

  await query(
    "DELETE FROM teacher_classes WHERE user_id = $1 AND session_id = $2",
    [teacherId, session.id],
  );
  for (const classId of classIds) {
    await query(
      `INSERT INTO teacher_classes (user_id, session_id, class_level_id, center_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [teacherId, session.id, classId, teacher.center_id],
    );
  }
  revalidatePath("/manage/allocations");
  return { ok: `Allotted ${classIds.length} class${classIds.length === 1 ? "" : "es"}.` };
}
