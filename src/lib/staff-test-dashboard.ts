import "server-only";
import { one, query } from "./db";

/**
 * What the office reads about the staff tests.
 *
 * Every query takes the role and, where it makes sense, a centre, because the
 * questions a teacher gets wrong at one centre are a training problem for
 * that centre's manager, not for the organisation.
 */

/** `AND` clauses for the role and centre in view, built once. */
function scope(role: string, centerId: number | null, args: unknown[], alias = "t") {
  args.push(role);
  let w = ` AND ${alias}.for_role = $${args.length}`;
  if (centerId) { args.push(centerId); w += ` AND ${alias}.center_id = $${args.length}`; }
  return w;
}

/** The numbers across the top: taken, scored, beaten by the clock. */
export function testHeadline(role: string, centerId: number | null, months: number) {
  const args: unknown[] = [months];
  const w = scope(role, centerId, args);
  return one<{
    papers: number; people: number; submitted: number; expired: number;
    avg_pct: number | null; pass_pct: number | null; unanswered: number;
  }>(
    `SELECT count(*)::int AS papers,
            count(DISTINCT t.user_id)::int AS people,
            count(*) FILTER (WHERE t.status = 'submitted')::int AS submitted,
            count(*) FILTER (WHERE t.status = 'expired')::int   AS expired,
            round(avg(100.0 * t.score / NULLIF(t.total, 0))
                  FILTER (WHERE t.status <> 'in_progress'))::int AS avg_pct,
            round(100.0 * count(*) FILTER (WHERE t.status <> 'in_progress'
                                             AND t.score * 2 >= t.total)
                  / NULLIF(count(*) FILTER (WHERE t.status <> 'in_progress'), 0))::int AS pass_pct,
            (SELECT count(*) FROM staff_test_answers a
               JOIN staff_tests t2 ON t2.id = a.test_id
              WHERE a.chosen_index IS NULL AND t2.status = 'expired'
                AND t2.cycle_month > (date_trunc('month', CURRENT_DATE)
                                      - make_interval(months => $1))::date)::int AS unanswered
       FROM staff_tests t
      WHERE t.cycle_month > (date_trunc('month', CURRENT_DATE)
                             - make_interval(months => $1))::date ${w}`,
    args);
}

/** Month by month: how many papers, and how they scored. */
export function scoresByMonth(role: string, centerId: number | null, months: number) {
  const args: unknown[] = [months];
  const w = scope(role, centerId, args);
  return query<{ month: string; papers: number; avg_pct: number | null; expired: number }>(
    `SELECT to_char(t.cycle_month, 'YYYY-MM') AS month,
            count(*)::int AS papers,
            round(avg(100.0 * t.score / NULLIF(t.total, 0))
                  FILTER (WHERE t.status <> 'in_progress'))::int AS avg_pct,
            count(*) FILTER (WHERE t.status = 'expired')::int AS expired
       FROM staff_tests t
      WHERE t.cycle_month > (date_trunc('month', CURRENT_DATE)
                             - make_interval(months => $1))::date ${w}
      GROUP BY t.cycle_month ORDER BY t.cycle_month`,
    args);
}

/**
 * Centre by centre for the month in view: who is on the roll for this test,
 * how many of them have taken it, and how they did.
 */
export function byCentre(role: string, cycle: string, centerId: number | null) {
  const args: unknown[] = [cycle, role];
  const c = centerId ? ` AND ce.id = $${args.push(centerId)}` : "";
  return query<{
    center_name: string; staff: number; took: number; papers: number; avg_pct: number | null;
  }>(
    `SELECT ce.name AS center_name,
            count(DISTINCT u.id)::int AS staff,
            count(DISTINCT t.user_id)::int AS took,
            count(t.id)::int AS papers,
            round(avg(100.0 * t.score / NULLIF(t.total, 0))
                  FILTER (WHERE t.status <> 'in_progress'))::int AS avg_pct
       FROM centers ce
       JOIN users u ON u.center_id = ce.id AND u.is_active AND u.role = $2
       LEFT JOIN staff_tests t ON t.user_id = u.id AND t.cycle_month = $1
      WHERE ce.is_active ${c}
      GROUP BY ce.id, ce.code, ce.name
      ORDER BY ce.code`,
    args);
}

/**
 * The questions most often got wrong. This is the point of the whole thing:
 * it says what to teach next, not who to blame.
 */
export function hardestQuestions(role: string, centerId: number | null, limit = 8) {
  const args: unknown[] = [role];
  const c = centerId ? ` AND t.center_id = $${args.push(centerId)}` : "";
  args.push(limit);
  return query<{
    id: number; question_en: string; question_hi: string; topic: string | null;
    asked: number; wrong: number; wrong_pct: number;
  }>(
    `SELECT q.id, q.question_en, q.question_hi, q.topic,
            count(*)::int AS asked,
            count(*) FILTER (WHERE a.is_correct IS NOT TRUE)::int AS wrong,
            round(100.0 * count(*) FILTER (WHERE a.is_correct IS NOT TRUE) / count(*))::int AS wrong_pct
       FROM staff_test_answers a
       JOIN staff_tests t ON t.id = a.test_id
       JOIN staff_test_questions q ON q.id = a.question_id
      WHERE t.for_role = $1 AND t.status <> 'in_progress' ${c}
      GROUP BY q.id, q.question_en, q.question_hi, q.topic
     HAVING count(*) >= 3
      ORDER BY count(*) FILTER (WHERE a.is_correct IS NOT TRUE) DESC, count(*) DESC
      LIMIT $${args.length}`,
    args);
}

/** How each topic is going — the same reading, one level up from a question. */
export function byTopic(role: string, centerId: number | null) {
  const args: unknown[] = [role];
  const c = centerId ? ` AND t.center_id = $${args.push(centerId)}` : "";
  return query<{ topic: string; asked: number; right: number; right_pct: number }>(
    `SELECT COALESCE(q.topic, 'Not filed under a topic') AS topic,
            count(*)::int AS asked,
            count(*) FILTER (WHERE a.is_correct)::int AS right,
            round(100.0 * count(*) FILTER (WHERE a.is_correct) / count(*))::int AS right_pct
       FROM staff_test_answers a
       JOIN staff_tests t ON t.id = a.test_id
       JOIN staff_test_questions q ON q.id = a.question_id
      WHERE t.for_role = $1 AND t.status <> 'in_progress' ${c}
      GROUP BY 1 ORDER BY 4 ASC, 2 DESC`,
    args);
}

/** Scores in bands, so a room of middling results reads differently from a split one. */
export function scoreSpread(role: string, centerId: number | null, months: number) {
  const args: unknown[] = [months];
  const w = scope(role, centerId, args);
  return query<{ band: string; papers: number }>(
    `WITH scored AS (
       SELECT round(100.0 * t.score / NULLIF(t.total, 0)) AS pct
         FROM staff_tests t
        WHERE t.status <> 'in_progress'
          AND t.cycle_month > (date_trunc('month', CURRENT_DATE)
                               - make_interval(months => $1))::date ${w}
     ),
     bands AS (SELECT * FROM (VALUES
       (1, '0–20%', 0, 20), (2, '21–40%', 21, 40), (3, '41–60%', 41, 60),
       (4, '61–80%', 61, 80), (5, '81–100%', 81, 100)) AS b(ord, band, lo, hi))
     SELECT b.band,
            (SELECT count(*) FROM scored s WHERE s.pct >= b.lo AND s.pct <= b.hi)::int AS papers
       FROM bands b ORDER BY b.ord`,
    args);
}

/** Who has not taken this month's test — the list to chase. */
export function notTakenYet(role: string, cycle: string, centerId: number | null) {
  const args: unknown[] = [cycle, role];
  const c = centerId ? ` AND u.center_id = $${args.push(centerId)}` : "";
  return query<{
    id: number; name: string; center_name: string | null; last_taken: string | null;
    papers: number; avg_pct: number | null;
  }>(
    `SELECT u.id, u.name, ce.name AS center_name,
            to_char(max(t.started_at) FILTER (WHERE t.cycle_month < $1),
                    'YYYY-MM-DD') AS last_taken,
            count(t.id) FILTER (WHERE t.status <> 'in_progress')::int AS papers,
            round(avg(100.0 * t.score / NULLIF(t.total, 0))
                  FILTER (WHERE t.status <> 'in_progress'))::int AS avg_pct
       FROM users u
       LEFT JOIN centers ce ON ce.id = u.center_id
       LEFT JOIN staff_tests t ON t.user_id = u.id
      WHERE u.is_active AND u.role = $2 ${c}
        AND NOT EXISTS (SELECT 1 FROM staff_tests x
                         WHERE x.user_id = u.id AND x.cycle_month = $1)
      GROUP BY u.id, u.name, ce.name
      ORDER BY ce.name NULLS LAST, u.name`,
    args);
}

/** The people with the most papers behind them, best first. */
export function standings(role: string, centerId: number | null, months: number, limit = 10) {
  const args: unknown[] = [months];
  const w = scope(role, centerId, args);
  args.push(limit);
  return query<{
    id: number; name: string; center_name: string | null;
    papers: number; avg_pct: number; best_pct: number; expired: number;
  }>(
    `SELECT u.id, u.name, ce.name AS center_name,
            count(*)::int AS papers,
            round(avg(100.0 * t.score / NULLIF(t.total, 0)))::int AS avg_pct,
            round(max(100.0 * t.score / NULLIF(t.total, 0)))::int AS best_pct,
            count(*) FILTER (WHERE t.status = 'expired')::int AS expired
       FROM staff_tests t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN centers ce ON ce.id = t.center_id
      WHERE t.status <> 'in_progress'
        AND t.cycle_month > (date_trunc('month', CURRENT_DATE)
                             - make_interval(months => $1))::date ${w}
      GROUP BY u.id, u.name, ce.name
      ORDER BY avg_pct DESC, papers DESC
      LIMIT $${args.length}`,
    args);
}
