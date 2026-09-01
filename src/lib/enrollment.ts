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
  const seq = rows[0].next_seq;
  await client.query(
    "UPDATE enrollment_counters SET next_seq = next_seq + 1 WHERE center_id = $1",
    [centerId],
  );

  const prefix = process.env.ENROLLMENT_PREFIX || "FP";
  return `${prefix}-${center.rows[0].code}-${String(seq).padStart(4, "0")}`;
}
