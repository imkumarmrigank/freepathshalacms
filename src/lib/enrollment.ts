import type { PoolClient } from "pg";

/**
 * Allocate the next enrolment number for a centre.
 * Format: <PREFIX>-<CENTRE CODE>-<0001>  e.g. FP-C04-0007
 * Must run inside a transaction — the counter row is locked FOR UPDATE.
 */
export async function nextEnrollmentNo(
  client: PoolClient,
  centerId: number,
): Promise<string> {
  const center = await client.query<{ code: string }>(
    "SELECT code FROM centers WHERE id = $1",
    [centerId],
  );
  if (!center.rows[0]) throw new Error("Centre not found");

  await client.query(
    `INSERT INTO enrollment_counters (center_id, next_seq) VALUES ($1, 1)
     ON CONFLICT (center_id) DO NOTHING`,
    [centerId],
  );
  const { rows } = await client.query<{ next_seq: number }>(
    "SELECT next_seq FROM enrollment_counters WHERE center_id = $1 FOR UPDATE",
    [centerId],
  );

  // The counter is the source of truth, but a row written straight into the
  // table — a bulk import, a correction run — does not advance it, and the next
  // admission then collides with an enrolment number already taken and fails
  // with a unique-violation the centre reads as "duplicate entry". Take
  // whichever is higher, so the counter repairs itself the first time it is used.
  //
  // Counted by this centre's own number series, wherever the child now is: a
  // child transferred out keeps FP-8-0105, so 0105 must never be issued again,
  // and a child transferred in with FP-3-0240 must not push this centre's
  // series forward to 0241.
  const prefix = process.env.ENROLLMENT_PREFIX || "FP";
  const series = `${prefix}-${center.rows[0].code}-`;
  const { rows: used } = await client.query<{ highest: number | null }>(
    `SELECT max(substring(enrollment_no from '[0-9]+$')::int) AS highest
       FROM students WHERE left(enrollment_no, length($1)) = $1`,
    [series],
  );
  const seq = Math.max(rows[0].next_seq, Number(used[0]?.highest ?? 0) + 1);
  await client.query(
    "UPDATE enrollment_counters SET next_seq = $2 WHERE center_id = $1",
    [centerId, seq + 1],
  );

  return `${series}${String(seq).padStart(4, "0")}`;
}
