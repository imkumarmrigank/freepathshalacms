/**
 * Reads the structure of a PostgreSQL database into a plain object, so the
 * MariaDB schema (and the data copier) can be generated from what is actually
 * live rather than from 68 migration files that edit each other.
 */
import pg from "pg";

export function connect(url) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  return new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 20000,
  });
}

export async function loadModel(pool) {
  const q = async (text, params = []) => (await pool.query(text, params)).rows;

  const cols = await q(`
    SELECT c.relname AS tbl, a.attnum, a.attname AS col,
           t.typname AS udt, format_type(a.atttypid, a.atttypmod) AS fmt,
           a.attnotnull AS notnull,
           pg_get_expr(d.adbin, d.adrelid) AS dflt,
           (t.typcategory = 'A') AS is_array
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid AND c.relkind = 'r'
      JOIN pg_type t ON t.oid = a.atttypid
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE c.relnamespace = 'public'::regnamespace AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`);

  const cons = await q(`
    SELECT c.relname AS tbl, k.conname AS name, k.contype AS type,
           pg_get_constraintdef(k.oid) AS def,
           (SELECT array_agg(a.attname::text ORDER BY u.ord)
              FROM unnest(k.conkey) WITH ORDINALITY u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.attnum) AS cols,
           rc.relname AS ref_tbl,
           (SELECT array_agg(a.attname::text ORDER BY u.ord)
              FROM unnest(k.confkey) WITH ORDINALITY u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.attnum) AS ref_cols,
           k.confdeltype AS on_delete, k.confupdtype AS on_update
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      LEFT JOIN pg_class rc ON rc.oid = k.confrelid
     WHERE c.relnamespace = 'public'::regnamespace AND k.contype IN ('p','u','f','c')
     ORDER BY c.relname, k.conname`);

  const idx = await q(`
    SELECT c.relname AS tbl, ic.relname AS name, i.indisunique AS uniq, i.indisprimary AS pk,
           pg_get_indexdef(i.indexrelid) AS def,
           pg_get_expr(i.indpred, i.indrelid) AS pred,
           (i.indexprs IS NOT NULL) AS has_expr,
           EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid) AS backs_constraint,
           (SELECT array_agg(a.attname::text ORDER BY u.ord)
              FROM unnest(i.indkey::int2[]) WITH ORDINALITY u(attnum, ord)
              JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = u.attnum
             WHERE u.attnum > 0) AS cols,
           am.amname AS method
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_am am ON am.oid = ic.relam
     WHERE c.relnamespace = 'public'::regnamespace
     ORDER BY c.relname, ic.relname`);

  const tables = {};
  for (const c of cols) {
    (tables[c.tbl] ??= { name: c.tbl, columns: [], constraints: [], indexes: [] }).columns.push(c);
  }
  for (const k of cons) tables[k.tbl].constraints.push(k);
  for (const i of idx) tables[i.tbl].indexes.push(i);
  return tables;
}
