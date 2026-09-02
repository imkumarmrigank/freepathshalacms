/**
 * One page of a list. Every long table asks for `count(*) OVER ()` alongside its
 * rows, so a page costs one query rather than two.
 *
 * Shared by server and client — nothing server-only in here.
 */

export const PAGE_SIZE = 50;

export type Paged = { page: number; size: number; offset: number };

/**
 * Reads ?page= off the query string, clamped to something sane. A page holding
 * several independent lists passes a different `param` for each.
 */
export function pageFrom(
  sp: Record<string, string | undefined>,
  size = PAGE_SIZE,
  param = "page",
): Paged {
  const n = Number(sp[param]);
  const page = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return { page, size, offset: (page - 1) * size };
}

/** The window a page covers, for "Showing 51–100 of 639". */
export function pageWindow(p: Paged, rowsOnPage: number, total: number) {
  const first = total === 0 ? 0 : p.offset + 1;
  return { first, last: p.offset + rowsOnPage, total, pages: Math.ceil(total / p.size) };
}

/**
 * Postgres returns count(*) OVER () on every row; it is the same number each
 * time, and absent entirely when the page came back empty.
 */
export function totalOf(rows: { total_rows?: string | number }[], fallback = 0) {
  return rows.length > 0 ? Number(rows[0].total_rows) : fallback;
}
