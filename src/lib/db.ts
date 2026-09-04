import pg, { Pool, type PoolClient, type QueryResultRow } from "pg";

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

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX ?? 5),
    // Neon closes idle connections on its side, and a sleeping Render instance
    // wakes with sockets that are already dead. Recycle ours well before that so
    // we rarely hand out a corpse, and keep the survivors alive.
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
  });

  // The centres are in India, the server is in Singapore and Neon runs in
  // Ohio on GMT — three clocks, and three different answers to "what is
  // today". Every connection is put on India's, so CURRENT_DATE and now()
  // mean what a teacher marking the register means.
  pool.on("connect", (client) => {
    client.query("SET TIME ZONE 'Asia/Kolkata'").catch(() => {
      // a failed SET must not take the connection down; the app still works,
      // it is only the date boundary that would drift
    });
  });

  // Without this, an error on an *idle* client is an unhandled 'error' event on
  // the pool, which takes the whole server process down.
  pool.on("error", (err) => {
    console.warn("[db] idle client error (it will be replaced):", err.message);
  });

  return pool;
}

/**
 * Built on first use, not at import. Next collects route metadata at build time,
 * and a build machine has no database credentials — constructing the pool eagerly
 * turned that into a build failure.
 */
export function getPool(): Pool {
  if (!global.__fpPool) global.__fpPool = makePool();
  return global.__fpPool;
}

/**
 * Errors that mean "this particular socket is dead", not "your query is wrong".
 * The first request after the dyno or the database has been idle hits these,
 * which is why a page used to fail once and then work on reload.
 */
const TRANSIENT = new Set([
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED",
  "08000", "08003", "08006", "08001", "08004",  // connection exception family
  "57P01", "57P02", "57P03",                    // admin shutdown / crash / not ready
  "XX000",                                      // Neon uses this when waking up
]);

function isTransient(err: unknown) {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException & { code?: string }).code;
  if (code && TRANSIENT.has(code)) return true;
  return /terminated unexpectedly|Connection terminated|connection closed|socket hang up|server closed the connection|Client has encountered a connection error|timeout exceeded when trying to connect/i
    .test(err.message);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries only connection-level failures; a real SQL error is thrown at once. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      // Neon takes a moment to wake from suspend; back off a little each time.
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await withRetry(() => getPool().query<T>(text, params as never[]));
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs a set of statements in one transaction.
 *
 * Only the checkout is retried. Once BEGIN has run we cannot know whether a
 * dropped connection committed, so a mid-transaction failure is surfaced rather
 * than replayed — re-running an enrolment or a supply issue would double it.
 */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await withRetry(() => getPool().connect());
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // the connection is already gone; the transaction dies with it
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap liveness probe used by /api/health. */
export async function ping() {
  const started = Date.now();
  await query("SELECT 1");
  return Date.now() - started;
}
