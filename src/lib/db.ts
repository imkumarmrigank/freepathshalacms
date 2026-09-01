import pg, { Pool, type QueryResultRow } from "pg";

/**
 * node-postgres hands BIGINT (int8) back as a string so that values beyond
 * Number.MAX_SAFE_INTEGER survive. Every id in this schema is a BIGSERIAL that
 * will never come close to 2^53, and leaving them as strings silently breaks
 * `===` comparisons against ids we parsed from forms and query strings.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

/**
 * DATE columns are calendar days, not instants. Left alone, node-postgres turns
 * them into local Date objects, which both shifts the day across timezones and
 * makes `"2026-09-01" > start_date` compare against "Sat Apr 01 2026 …". Keeping
 * the raw YYYY-MM-DD string makes date comparisons and rendering correct.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __fpPool: Pool | undefined;
}

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
}

export const pool: Pool = global.__fpPool ?? makePool();
if (process.env.NODE_ENV !== "production") global.__fpPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Run a set of statements inside a single transaction. */
export async function tx<T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
