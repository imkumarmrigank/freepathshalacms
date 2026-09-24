"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { TESTED_ROLES } from "@/lib/staff-test-meta";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** The four option boxes, in both languages, trimmed and paired up. */
function optionsFrom(form: FormData) {
  const en: string[] = [];
  const hi: string[] = [];
  for (let i = 0; i < 6; i++) {
    const e = String(form.get(`option_en_${i}`) ?? "").trim();
    const h = String(form.get(`option_hi_${i}`) ?? "").trim();
    if (!e && !h) continue;
    en.push(e);
    hi.push(h || e);
  }
  return { en, hi };
}

export async function saveQuestion(_prev: unknown, form: FormData) {
  const user = await requireRole("super_admin", "admin");
  const id = Number(form.get("id")) || null;
  const role = String(form.get("for_role") ?? "");
  if (!(TESTED_ROLES as readonly string[]).includes(role))
    return { error: "Pick whose test this question belongs to." };

  const qEn = str(form, "question_en");
  const qHi = str(form, "question_hi");
  if (!qEn || !qHi)
    return { error: "A question needs both the English and the Hindi wording." };

  const { en, hi } = optionsFrom(form);
  if (en.length < 2) return { error: "Give at least two options." };
  if (en.some((o) => !o)) return { error: "Every option needs its English wording." };

  const correct = Number(form.get("correct_index"));
  if (!Number.isInteger(correct) || correct < 0 || correct >= en.length)
    return { error: "Mark which option is the right one." };

  if (id) {
    await query(
      `UPDATE staff_test_questions
          SET for_role=$2, topic=$3, question_en=$4, question_hi=$5,
              options_en=$6, options_hi=$7, correct_index=$8,
              note_en=$9, note_hi=$10, is_active=$11, updated_at=now()
        WHERE id=$1`,
      [id, role, str(form, "topic"), qEn, qHi, en, hi, correct,
       str(form, "note_en"), str(form, "note_hi"), form.get("is_active") !== null]);
  } else {
    await query(
      `INSERT INTO staff_test_questions
         (for_role, topic, question_en, question_hi, options_en, options_hi,
          correct_index, note_en, note_hi, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [role, str(form, "topic"), qEn, qHi, en, hi, correct,
       str(form, "note_en"), str(form, "note_hi"), user.uid]);
  }

  revalidatePath("/manage/tests");
  return { ok: id ? "Question updated." : "Question added." };
}

/**
 * Removing a question. One already used in somebody's paper is retired rather
 * than deleted — deleting it would tear a hole in a result that has already
 * been shown to the person who took it.
 */
export async function deleteQuestion(_prev: unknown, form: FormData) {
  await requireRole("super_admin", "admin");
  const id = Number(form.get("id"));
  const used = await one<{ n: string }>(
    "SELECT count(*) AS n FROM staff_test_answers WHERE question_id = $1", [id]);
  if (Number(used?.n ?? 0) > 0) {
    await query("UPDATE staff_test_questions SET is_active = FALSE, updated_at = now() WHERE id = $1", [id]);
    revalidatePath("/manage/tests");
    return { ok: "That question has been used in a test, so it is retired rather than deleted — it will not be asked again." };
  }
  await query("DELETE FROM staff_test_questions WHERE id = $1", [id]);
  revalidatePath("/manage/tests");
  return { ok: "Question deleted." };
}

export async function saveTestConfig(_prev: unknown, form: FormData) {
  const user = await requireRole("super_admin", "admin");
  const role = String(form.get("for_role") ?? "");
  if (!(TESTED_ROLES as readonly string[]).includes(role))
    return { error: "Unknown role." };

  const minutes = Number(form.get("duration_minutes"));
  const count = Number(form.get("question_count"));
  const perMonth = Number(form.get("tests_per_month"));
  const avoid = Number(form.get("avoid_last_tests"));
  if (!(minutes >= 1 && minutes <= 180)) return { error: "The test must run between 1 and 180 minutes." };
  if (!(count >= 1 && count <= 50)) return { error: "A paper holds between 1 and 50 questions." };
  if (!(perMonth >= 1 && perMonth <= 12)) return { error: "Between 1 and 12 tests a month." };
  if (!(avoid >= 0 && avoid <= 10)) return { error: "Hold back the questions of 0 to 10 recent tests." };

  await query(
    `INSERT INTO staff_test_config
       (for_role, duration_minutes, question_count, tests_per_month, avoid_last_tests,
        is_open, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (for_role) DO UPDATE
       SET duration_minutes = EXCLUDED.duration_minutes,
           question_count = EXCLUDED.question_count,
           tests_per_month = EXCLUDED.tests_per_month,
           avoid_last_tests = EXCLUDED.avoid_last_tests,
           is_open = EXCLUDED.is_open,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [role, minutes, count, perMonth, avoid, form.get("is_open") !== null, user.uid]);

  revalidatePath("/manage/tests");
  return { ok: "Test settings saved." };
}

/**
 * One person's paper, for the office to read: the questions as they were
 * asked, what they picked and what was right.
 */
export async function loadPaper(testId: number) {
  await requireRole("super_admin", "admin");
  const test = await one<{
    id: number; name: string; role: string; center_name: string | null;
    cycle_month: string; slot: number; status: string; score: number | null;
    total: number; started_at: string; submitted_at: string | null;
    duration_minutes: number; minutes: number | null;
  }>(
    `SELECT t.id, u.name, u.role, c.name AS center_name,
            to_char(t.cycle_month, 'YYYY-MM-DD') AS cycle_month, t.slot, t.status,
            t.score, t.total, t.started_at, t.submitted_at, t.duration_minutes,
            CASE WHEN t.submitted_at IS NOT NULL
                 THEN round(extract(epoch FROM t.submitted_at - t.started_at) / 60)
            END::int AS minutes
       FROM staff_tests t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN centers c ON c.id = t.center_id
      WHERE t.id = $1`, [testId]);
  if (!test) return { error: "That paper was not found." };

  const paper = await query<{
    position: number; question_en: string; question_hi: string; topic: string | null;
    options_en: string[]; options_hi: string[]; correct_index: number;
    chosen_index: number | null; is_correct: boolean | null;
  }>(
    `SELECT a.position, q.question_en, q.question_hi, q.topic,
            q.options_en, q.options_hi, q.correct_index,
            a.chosen_index, a.is_correct
       FROM staff_test_answers a
       JOIN staff_test_questions q ON q.id = a.question_id
      WHERE a.test_id = $1
      ORDER BY a.position`, [testId]);

  return { test, paper };
}
