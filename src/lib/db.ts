import mysql, { type Pool, type PoolConnection, type ResultSetHeader } from "mysql2/promise";
import { bind, compile, configure } from "./sql-compat";
import { DATE_COLUMNS, TIMESTAMP_COLUMNS } from "./sql-columns";

/**
 * The app is written in PostgreSQL-flavoured SQL; sql-compat turns each statement into
 * MariaDB SQL the first time it is seen. Everything below keeps the shape the rest of the
 * app already uses: query() returns rows, one() returns a row or null, tx() runs a set of
 * statements in a transaction and hands its callback a client with a pg-style query().
 */
configure({ dateColumns: DATE_COLUMNS, timestampColumns: TIMESTAMP_COLUMNS });

export type DbResult<T> = { rows: T[]; rowCount: number | null; insertId?: number };
export interface DbClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(text: string, params?: unknown[]): Promise<DbResult<T>>;
}
/** The name the rest of the app imported from "pg". */
export type PoolClient = DbClient;

declare global {
  // eslint-disable-next-line no-var
  var __fpPool: Pool | undefined;
}

/** IST everywhere: the app has always run on Asia/Kolkata, so TIMESTAMPs read and write in it. */
const TZ = "+05:30";

/**
 * Per connection: PostgreSQL's `||` is string concatenation and "double quotes" name
 * identifiers; keep MariaDB's default strict mode but drop ONLY_FULL_GROUP_BY, which
 * PostgreSQL-style queries do not satisfy.
 */
const INIT_SQL =
  `SET SESSION time_zone = '${TZ}', group_concat_max_len = 1048576, explicit_defaults_for_timestamp = 1, ` +
  `sql_mode = CONCAT(REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''), ',PIPES_AS_CONCAT,ANSI_QUOTES')`;

function makePool(): Pool {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const u = new URL(raw); // mysql://user:password@host:3306/database
  if (!/^mysql/.test(u.protocol)) throw new Error("DATABASE_URL must be a mysql:// address");

  const pool = mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: u.searchParams.get("ssl") === "true" ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_MAX ?? 5),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: TZ,
    // DATE columns are calendar days, not instants: keep "YYYY-MM-DD" so they never shift
    // across timezones. (TIMESTAMPs still arrive as Date objects.)
    dateStrings: ["DATE"],
    supportBigNumbers: true,
    bigNumberStrings: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    connectTimeout: 15_000,
    typeCast(field, next) {
      // TINYINT(1) columns are booleans
      if (field.type === "TINY" && field.length === 1) {
        const v = field.string();
        return v === null ? null : v !== "0";
      }
      // DECIMAL keeps its scale as a string ("20.00") like PostgreSQL numeric, but a whole
      // number — the result of SUM() over integers — comes back as a number
      if (field.type === "NEWDECIMAL" || field.type === "DECIMAL") {
        const v = field.string();
        if (v === null) return null;
        return /^-?\d+$/.test(v) ? Number(v) : v;
      }
      return next();
    },
  });

  pool.pool.on("connection", (conn) => {
    conn.query(INIT_SQL, (err: Error | null) => {
      if (err) console.warn("[db] could not set session options:", err.message);
    });
  });
  return pool;
}

/**
 * Built on first use, not at import. Next collects route metadata at build time, and a build
 * machine has no database credentials.
 */
export function getPool(): Pool {
  if (!global.__fpPool) global.__fpPool = makePool();
  return global.__fpPool;
}

/** Errors that mean "this socket is dead", not "your query is wrong". */
const TRANSIENT = new Set([
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED",
  "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR", "ER_SERVER_SHUTDOWN",
]);

function isTransient(err: unknown) {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException & { code?: string }).code;
  if (code && TRANSIENT.has(code)) return true;
  return /server has gone away|connection (is )?closed|closed state|Connection lost|socket hang up/i.test(err.message);
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
      await sleep(250 * (i + 1));
    }
  }
  throw lastErr;
}

async function run<T>(conn: Pool | PoolConnection, text: string, params: unknown[]): Promise<DbResult<T>> {
  const { sql, values } = bind(compile(text), params);
  const [res] = await conn.query(sql, values);
  if (Array.isArray(res)) return { rows: res as T[], rowCount: res.length };
  const h = res as ResultSetHeader;
  return { rows: [], rowCount: h.affectedRows, insertId: h.insertId };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const res = await withRetry(() => run<T>(getPool(), text, params));
  return res.rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function one<T = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs a set of statements in one transaction.
 *
 * Only the checkout is retried. Once the transaction has begun we cannot know whether a
 * dropped connection committed, so a mid-transaction failure is surfaced rather than
 * replayed — re-running an enrolment or a supply issue would double it.
 */
export async function tx<T>(fn: (c: DbClient) => Promise<T>): Promise<T> {
  const conn = await withRetry(() => getPool().getConnection());
  try {
    await conn.beginTransaction();
    const client: DbClient = { query: (text, params = []) => run(conn, text, params) };
    const out = await fn(client);
    await conn.commit();
    return out;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      // the connection is already gone; the transaction dies with it
    }
    throw err;
  } finally {
    conn.release();
  }
}

/** Cheap liveness probe used by /api/health. */
export async function ping() {
  const started = Date.now();
  await query("SELECT 1");
  return Date.now() - started;
}
