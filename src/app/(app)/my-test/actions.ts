"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import {
  closeIfExpired, currentCycle, drawQuestions, testById, testConfig,
} from "@/lib/staff-tests";

/**
 * Start this slot's paper. The questions are drawn and written down now, so a
 * reload — or a phone that dies mid-test — comes back to the same ten
 * questions rather than a fresh set.
 */
export async function startTest(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const role = String(form.get("role") || user.role);
  if (role !== user.role) return { error: "That is not your test." };

  const cfg = await testConfig(role);
  if (!cfg.is_open) return { error: "The test is closed at the moment." };

  const { cycle, slot } = currentCycle(cfg);
  const already = await one<{ id: number }>(
    `SELECT id FROM staff_tests WHERE user_id = $1 AND cycle_month = $2 AND slot = $3`,
    [user.uid, cycle, slot]);
  if (already) redirect(`/my-test/${already.id}`);

  const ids = await drawQuestions(user.uid, role, cfg.question_count, cfg.avoid_last_tests);
  if (ids.length === 0)
    return { error: "There are no questions in the bank yet. Ask your administrator." };

  const id = await tx(async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO staff_tests
         (user_id, for_role, center_id, cycle_month, slot, duration_minutes,
          expires_at, total)
       VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(mins => $6), $7)
       RETURNING id`,
      [user.uid, role, user.centerId, cycle, slot, cfg.duration_minutes, ids.length]);
    const testId = rows[0].id;
    await c.query(
      `INSERT INTO staff_test_answers (test_id, question_id, position)
       SELECT $1, q, ord FROM unnest($2::bigint[]) WITH ORDINALITY AS t(q, ord)`,
      [testId, ids]);
    return testId;
  });

  revalidatePath("/my-test");
  redirect(`/my-test/${id}`);
}

/**
 * One answer. Marked on the server against the stored question, so the browser
 * is never trusted with what is right, and never allowed to change an answer
 * once it has been told.
 */
export async function answerQuestion(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const testId = Number(form.get("test_id"));
  const position = Number(form.get("position"));
  const chosen = Number(form.get("chosen"));

  const test = await testById(testId);
  if (!test || test.user_id !== user.uid) return { error: "That is not your test." };
  if (test.status !== "in_progress") return { error: "This test is already over." };
  if (new Date(test.expires_at).getTime() <= Date.now()) {
    await closeIfExpired(test);
    revalidatePath(`/my-test/${testId}`);
    return { error: "Time is up — this answer was not counted." };
  }

  const row = await one<{ id: number; correct_index: number; chosen_index: number | null }>(
    `SELECT a.id, q.correct_index, a.chosen_index
       FROM staff_test_answers a
       JOIN staff_test_questions q ON q.id = a.question_id
      WHERE a.test_id = $1 AND a.position = $2`, [testId, position]);
  if (!row) return { error: "That question is not on this paper." };
  if (row.chosen_index !== null) return { error: "You have already answered this one." };

  await query(
    `UPDATE staff_test_answers
        SET chosen_index = $2::smallint,
            is_correct = ($2::smallint = $3::smallint),
            answered_at = now()
      WHERE id = $1`,
    [row.id, chosen, row.correct_index]);

  // The right answer goes back with the reply, never before it: this is the
  // moment the person has earned the right to see it.
  return {
    ok: "Answer saved.",
    correct_index: row.correct_index,
    is_correct: chosen === row.correct_index,
  };
}

/** Hand the paper in — or let the clock do it. */
export async function submitTest(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const testId = Number(form.get("test_id"));
  const test = await testById(testId);
  if (!test || test.user_id !== user.uid) return { error: "That is not your test." };

  if (test.status === "in_progress") {
    const expired = new Date(test.expires_at).getTime() <= Date.now();
    await query(
      `UPDATE staff_tests t
          SET status = $2, submitted_at = now(),
              score = (SELECT count(*) FILTER (WHERE a.is_correct)::int
                         FROM staff_test_answers a WHERE a.test_id = t.id)
        WHERE t.id = $1`,
      [testId, expired ? "expired" : "submitted"]);
  }

  revalidatePath("/my-test");
  revalidatePath(`/my-test/${testId}`);
  return { ok: "Test submitted." };
}
