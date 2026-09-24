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
      WHERE ($3::bigint IS NULL OR s.id <> $3)
        AND (
          ($1::text IS NOT NULL AND s.aadhaar_number = $1)
          OR (array_length($2::text[], 1) > 0 AND (
                s.father_aadhaar_number = ANY($2)
             OR s.mother_aadhaar_number = ANY($2)
             OR s.guardian_aadhaar_number = ANY($2)))
        )
      ORDER BY s.id DESC`,
    [own, parents, p.excludeId ?? null],
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

/**
 * Brothers and sisters of the row's student, for a list that already joins
 * `students s`. Left-joined as `sib`, it adds `sib.n` and `sib.names`.
 *
 * Two children count as siblings when the admission clerk confirmed it, when
 * they share a parent's Aadhaar — families here give the same number for every
 * child — or when they share a phone and a parent's name. Only children still
 * on the roll are counted: the point of the mark is that the teacher in front
 * of this child has the other one too.
 */
export const SIBLING_JOIN = `LEFT JOIN LATERAL (
         SELECT count(*)::int AS n,
                string_agg(o.label, ', ' ORDER BY o.label) AS names
           FROM (
             SELECT trim(x.first_name || ' ' || COALESCE(x.last_name, ''))
                    || COALESCE(' · ' || cl2.name, '') AS label
               FROM students x
               LEFT JOIN enrollments e2 ON e2.student_id = x.id AND e2.status = 'active'
                    AND e2.session_id = (SELECT id FROM academic_sessions
                                          WHERE is_current LIMIT 1)
               LEFT JOIN class_levels cl2 ON cl2.id = e2.class_level_id
              WHERE x.id <> s.id AND x.status = 'active'
                AND (
                  EXISTS (SELECT 1 FROM student_siblings sb
                           WHERE (sb.student_a = s.id AND sb.student_b = x.id)
                              OR (sb.student_b = s.id AND sb.student_a = x.id))
                  OR (NULLIF(s.father_aadhaar_number, '') IS NOT NULL
                      AND x.father_aadhaar_number = s.father_aadhaar_number)
                  OR (NULLIF(s.mother_aadhaar_number, '') IS NOT NULL
                      AND x.mother_aadhaar_number = s.mother_aadhaar_number)
                  OR (NULLIF(s.guardian_aadhaar_number, '') IS NOT NULL
                      AND x.guardian_aadhaar_number = s.guardian_aadhaar_number)
                  OR (NULLIF(s.primary_phone, '') IS NOT NULL
                      AND x.primary_phone = s.primary_phone
                      AND (
                        (NULLIF(btrim(s.father_name), '') IS NOT NULL
                         AND lower(btrim(x.father_name)) = lower(btrim(s.father_name)))
                        OR (NULLIF(btrim(s.mother_name), '') IS NOT NULL
                            AND lower(btrim(x.mother_name)) = lower(btrim(s.mother_name)))))
                )) o) sib ON TRUE`;

/** The two columns that go with {@link SIBLING_JOIN}. */
export const SIBLING_COLS = `COALESCE(sib.n, 0) AS sibling_count, sib.names AS sibling_names`;

/** The same reckoning for one child, for their own page. */
export async function siblingMark(studentId: number) {
  const rows = await query<{ n: number; names: string | null }>(
    `SELECT COALESCE(sib.n, 0) AS n, sib.names
       FROM students s ${SIBLING_JOIN}
      WHERE s.id = $1`,
    [studentId]);
  return rows[0] ?? { n: 0, names: null };
}
