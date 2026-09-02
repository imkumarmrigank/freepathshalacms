import "server-only";
import type { PoolClient } from "pg";

/**
 * Whether a child passed the year, read off the tests they actually sat.
 *
 * Every graded paper in the session counts. A paper's pass mark is its own; if
 * none was set, a third of the maximum is used, which is what the test form
 * offers by default. A child is through if their total reaches the total of
 * those pass marks — one weak subject does not fail them, and a run of them does.
 *
 * Absent counts as zero: sitting the paper is part of passing it.
 */
export type ResultVerdict = {
  studentId: number;
  papers: number;
  obtained: number;
  max: number;
  passMark: number;
  /** null when the child has no marks at all — there is nothing to judge. */
  passed: boolean | null;
};

const DEFAULT_PASS_RATIO = 1 / 3;

export async function resultsForSession(
  client: PoolClient,
  sessionId: number,
  centerId: number | null,
): Promise<Map<number, ResultVerdict>> {
  const { rows } = await client.query<{
    student_id: number; papers: string; obtained: string; max: string; pass_mark: string;
  }>(
    `SELECT m.student_id,
            count(*)                                        AS papers,
            sum(CASE WHEN m.is_absent THEN 0
                     ELSE COALESCE(m.marks_obtained, 0) END) AS obtained,
            sum(x.max_marks)                                AS max,
            sum(COALESCE(x.pass_marks, x.max_marks * $2))    AS pass_mark
       FROM exam_marks m
       JOIN exams x ON x.id = m.exam_id
      WHERE x.session_id = $1
        AND (m.marks_obtained IS NOT NULL OR m.is_absent)
        ${centerId ? "AND x.center_id = $3" : ""}
      GROUP BY m.student_id`,
    centerId ? [sessionId, DEFAULT_PASS_RATIO, centerId] : [sessionId, DEFAULT_PASS_RATIO],
  );

  const out = new Map<number, ResultVerdict>();
  for (const r of rows) {
    const obtained = Number(r.obtained);
    const passMark = Number(r.pass_mark);
    out.set(r.student_id, {
      studentId: r.student_id,
      papers: Number(r.papers),
      obtained,
      max: Number(r.max),
      passMark,
      passed: obtained >= passMark,
    });
  }
  return out;
}

/**
 * What to do with one child, given their result and whatever the centre set by
 * hand. An explicit retain or hold always wins — a manager who has looked at
 * the child knows something the marks do not.
 */
export function decideFor(
  decision: string,
  verdict: ResultVerdict | undefined,
): { move: "promote" | "retain" | "hold"; basis: "result" | "manual" | "no_result" } {
  if (decision === "hold") return { move: "hold", basis: "manual" };
  if (decision === "retain") return { move: "retain", basis: "manual" };
  if (!verdict || verdict.papers === 0) return { move: "promote", basis: "no_result" };
  return { move: verdict.passed ? "promote" : "retain", basis: "result" };
}
