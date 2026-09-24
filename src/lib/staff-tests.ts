import "server-only";
import { one, query } from "./db";
import { cycleOf, slotOf, type TestedRole } from "./staff-test-meta";

export type TestConfig = {
  for_role: string; duration_minutes: number; question_count: number;
  tests_per_month: number; avoid_last_tests: number; is_open: boolean;
};

/** The settings for a role, with the defaults if the office never set any. */
export async function testConfig(role: string): Promise<TestConfig> {
  const row = await one<TestConfig>(
    `SELECT for_role, duration_minutes, question_count, tests_per_month,
            avoid_last_tests, is_open
       FROM staff_test_config WHERE for_role = $1`, [role]);
  return row ?? {
    for_role: role, duration_minutes: 10, question_count: 10,
    tests_per_month: 4, avoid_last_tests: 2, is_open: true,
  };
}

export type Paper = {
  id: number; position: number; question_id: number;
  question_en: string; question_hi: string;
  options_en: string[]; options_hi: string[];
  chosen_index: number | null; is_correct: boolean | null;
  /** Only ever sent to the browser once the answer is in, or the test is over. */
  correct_index: number | null; note_en: string | null; note_hi: string | null;
};

export type TestRow = {
  id: number; user_id: number; for_role: string; cycle_month: string; slot: number;
  duration_minutes: number; started_at: string; expires_at: string;
  submitted_at: string | null; status: string; score: number | null; total: number;
};

/** A person's papers, newest first — their own history page. */
export function testsOf(userId: number) {
  return query<TestRow & { answered: number }>(
    `SELECT t.*, (SELECT count(*) FROM staff_test_answers a
                   WHERE a.test_id = t.id AND a.chosen_index IS NOT NULL)::int AS answered
       FROM staff_tests t
      WHERE t.user_id = $1
      ORDER BY t.cycle_month DESC, t.slot DESC`, [userId]);
}

export function testById(id: number) {
  return one<TestRow>(`SELECT * FROM staff_tests WHERE id = $1`, [id]);
}

/**
 * The paper as the person sees it. The right answer travels with a question
 * only once it can no longer help: after they have answered it, or after the
 * test is over. Until then the browser is never told it.
 */
export async function paperOf(testId: number, reveal: boolean) {
  return query<Paper>(
    `SELECT a.id, a.position, a.question_id,
            q.question_en, q.question_hi, q.options_en, q.options_hi,
            a.chosen_index, a.is_correct,
            CASE WHEN $2 OR a.chosen_index IS NOT NULL THEN q.correct_index END AS correct_index,
            CASE WHEN $2 OR a.chosen_index IS NOT NULL THEN q.note_en END AS note_en,
            CASE WHEN $2 OR a.chosen_index IS NOT NULL THEN q.note_hi END AS note_hi
       FROM staff_test_answers a
       JOIN staff_test_questions q ON q.id = a.question_id
      WHERE a.test_id = $1
      ORDER BY a.position`, [testId, reveal]);
}

/** How many questions the bank holds for a role, and how many are usable. */
export function bankSize(role: string) {
  return one<{ total: number; active: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE is_active)::int AS active
       FROM staff_test_questions WHERE for_role = $1`, [role]);
}

/**
 * The questions for a new paper.
 *
 * Random from the bank, less anything this person met in their last few
 * papers — two by default, so a question cannot come round again for at least
 * three tests. If the bank is too thin for that, the exclusion is relaxed
 * rather than the paper being made short: a shorter test would quietly change
 * what the score means.
 */
export async function drawQuestions(
  userId: number, role: string, count: number, avoidLast: number,
) {
  const recent = avoidLast > 0
    ? await query<{ question_id: number }>(
        `SELECT DISTINCT a.question_id
           FROM staff_test_answers a
           JOIN (SELECT id FROM staff_tests
                  WHERE user_id = $1 AND for_role = $2
                  ORDER BY started_at DESC LIMIT $3) t ON t.id = a.test_id`,
        [userId, role, avoidLast])
    : [];
  const seen = recent.map((r) => r.question_id);

  const fresh = await query<{ id: number }>(
    `SELECT id FROM staff_test_questions
      WHERE for_role = $1 AND is_active
        AND ($2::bigint[] IS NULL OR NOT (id = ANY($2)))
      ORDER BY random() LIMIT $3`,
    [role, seen.length ? seen : null, count]);

  if (fresh.length >= count) return fresh.map((q) => q.id);

  // The bank cannot fill a paper without repeating; take the rest from the
  // questions held back, oldest-seen first.
  const filler = await query<{ id: number }>(
    `SELECT q.id FROM staff_test_questions q
      WHERE q.for_role = $1 AND q.is_active
        AND NOT (q.id = ANY($2::bigint[]))
      ORDER BY (SELECT max(t.started_at) FROM staff_test_answers a
                  JOIN staff_tests t ON t.id = a.test_id
                 WHERE a.question_id = q.id AND t.user_id = $3) ASC NULLS FIRST,
               random()
      LIMIT $4`,
    [role, fresh.map((q) => q.id), userId, count - fresh.length]);

  return [...fresh.map((q) => q.id), ...filler.map((q) => q.id)];
}

/** Which slot of which month we are in, for a role's settings. */
export function currentCycle(cfg: TestConfig, now = new Date()) {
  return { cycle: cycleOf(now), slot: slotOf(now, cfg.tests_per_month) };
}

/** The papers already taken this month, so the page can show the four slots. */
export function slotsTaken(userId: number, cycle: string) {
  return query<{ slot: number; id: number; status: string; score: number | null; total: number }>(
    `SELECT slot, id, status, score, total FROM staff_tests
      WHERE user_id = $1 AND cycle_month = $2 ORDER BY slot`, [userId, cycle]);
}

/**
 * A paper whose clock has run out but which nobody submitted — the person
 * closed the phone, or the network went. Marked expired, scored on what was
 * answered, so it stops sitting "in progress" for ever.
 */
export async function closeIfExpired(test: TestRow) {
  if (test.status !== "in_progress") return test;
  if (new Date(test.expires_at).getTime() > Date.now()) return test;
  const row = await one<TestRow>(
    `UPDATE staff_tests t
        SET status = 'expired',
            submitted_at = COALESCE(t.submitted_at, t.expires_at),
            score = (SELECT count(*) FILTER (WHERE a.is_correct)::int
                       FROM staff_test_answers a WHERE a.test_id = t.id)
      WHERE t.id = $1 RETURNING *`, [test.id]);
  return row ?? test;
}

export type { TestedRole };
