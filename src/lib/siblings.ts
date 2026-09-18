import "server-only";
import { query } from "./db";
import type { PoolClient } from "pg";

export type Match = {
  id: number; enrollment_no: string; admission_no: string | null;
  name: string; class_name: string | null; center_name: string;
  matched_on: string;
};

const digits = (v: string | null | undefined) =>
  v ? v.replace(/\D/g, "") || null : null;

/**
 * Children already on the roll who share an Aadhaar with the one being admitted.
 *
 * A shared parent Aadhaar almost always means a brother or sister — families
 * here give the same number for every child — so this is a question to ask, not
 * a reason to refuse. A shared Aadhaar on the child's own record is different:
 * that is either the same child twice, or a parent's number typed into the
 * child's box, and both are worth stopping for.
 */
export async function aadhaarMatches(p: {
  aadhaar?: string | null;
  fatherAadhaar?: string | null;
  motherAadhaar?: string | null;
  guardianAadhaar?: string | null;
  excludeId?: number | null;
}): Promise<Match[]> {
  const own = digits(p.aadhaar);
  const parents = [digits(p.fatherAadhaar), digits(p.motherAadhaar), digits(p.guardianAadhaar)]
    .filter((x): x is string => Boolean(x));
  if (!own && parents.length === 0) return [];

  return query<Match>(
    `SELECT DISTINCT ON (s.id)
            s.id, s.enrollment_no, s.admission_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name,
            cl.name AS class_name, ce.name AS center_name,
            CASE
              WHEN $1::text IS NOT NULL AND s.aadhaar_number = $1 THEN 'the same child Aadhaar'
              ELSE 'the same parent Aadhaar'
            END AS matched_on
       FROM students s
       JOIN centers ce ON ce.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE ($4::bigint IS NULL OR s.id <> $4)
        AND (
          ($1::text IS NOT NULL AND s.aadhaar_number = $1)
          OR (array_length($2::text[], 1) > 0 AND (
                s.father_aadhaar_number = ANY($2)
             OR s.mother_aadhaar_number = ANY($2)
             OR s.guardian_aadhaar_number = ANY($2)))
        )
      ORDER BY s.id DESC`,
    [own, parents, null, p.excludeId ?? null],
  );
}

/** Records a pair once, whichever way round it arrives. */
export async function linkSiblings(
  client: PoolClient, a: number, b: number, byUserId: number,
) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  if (lo === hi) return;
  await client.query(
    `INSERT INTO student_siblings (student_a, student_b, confirmed_by)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [lo, hi, byUserId],
  );
}

/** A child's brothers and sisters, for their page. */
export async function siblingsOf(studentId: number) {
  return query<{ id: number; enrollment_no: string; name: string; class_name: string | null }>(
    `SELECT s.id, s.enrollment_no,
            trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name,
            cl.name AS class_name
       FROM student_siblings sb
       JOIN students s ON s.id = CASE WHEN sb.student_a = $1 THEN sb.student_b ELSE sb.student_a END
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE sb.student_a = $1 OR sb.student_b = $1
      ORDER BY s.first_name`,
    [studentId],
  );
}
