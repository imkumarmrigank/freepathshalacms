import Link from "next/link";

export type SortDir = "asc" | "desc";

/**
 * Read ?sort= and ?dir= against a whitelist of columns. Anything not on the
 * list is ignored, so a hand-typed URL can never reach the SQL.
 */
export function sortFrom<K extends string>(
  sp: Record<string, string | undefined>, allowed: readonly K[],
): { sort: K | null; dir: SortDir } {
  const sort = allowed.includes(sp.sort as K) ? (sp.sort as K) : null;
  return { sort, dir: sp.dir === "desc" ? "desc" : "asc" };
}

/**
 * A column heading that sorts the table when clicked; clicking again reverses
 * it. Every other filter in the URL is kept, and the list goes back to its
 * first page, since page 4 of a different order is a different set of rows.
 */
export default function SortHeader({
  label, col, sort, dir, sp, basePath, className,
}: {
  label: string; col: string; sort: string | null; dir: SortDir;
  sp: Record<string, string | undefined>; basePath: string; className?: string;
}) {
  const on = sort === col;
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "page" && k !== "sort" && k !== "dir") next.set(k, v);
  next.set("sort", col);
  next.set("dir", on && dir === "asc" ? "desc" : "asc");

  return (
    <th className={className} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`${basePath}?${next.toString()}`} scroll={false}
        className={`inline-flex items-center gap-1 hover:text-[var(--brand)] ${on ? "text-[var(--ink,inherit)]" : ""}`}
        title={on ? (dir === "asc" ? "Sorted A→Z / low→high — click to reverse" : "Sorted Z→A / high→low — click to reverse") : `Sort by ${label.toLowerCase()}`}>
        {label}
        <span aria-hidden className={`text-[10px] ${on ? "" : "opacity-30"}`}>
          {on ? (dir === "asc" ? "▲" : "▼") : "▲▼"}
        </span>
      </Link>
    </th>
  );
}
