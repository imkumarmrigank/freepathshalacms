"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Page control for the long tables. It sits under the table and only appears
 * when there is more than one page, so short lists look exactly as before.
 */
export default function Pager({
  page, pages, first, last, total, unit = "row", param = "page",
}: {
  page: number; pages: number; first: number; last: number; total: number;
  unit?: string;
  /** Which query parameter this pager drives — a page with several lists gives each its own. */
  param?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const go = (n: number) => {
    const next = new URLSearchParams(params.toString());
    if (n <= 1) next.delete(param); else next.set(param, String(n));
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  };

  if (total === 0) return null;

  const label = `${first.toLocaleString("en-IN")}–${last.toLocaleString("en-IN")} of ` +
    `${total.toLocaleString("en-IN")} ${unit}${total === 1 ? "" : "s"}`;

  if (pages <= 1) {
    return (
      <div className="border-t border-[#f1f1f6] px-5 py-3 text-[13px] text-[var(--muted)]">
        {label}
      </div>
    );
  }

  // first, last, and a short run either side of where we are
  const around = new Set<number>([1, pages, page - 1, page, page + 1]);
  const shown = [...around].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f1f6] px-5 py-3 ${
      pending ? "opacity-60" : ""}`}>
      <span className="text-[13px] text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="pager-btn" disabled={page <= 1}
          onClick={() => go(page - 1)}>Previous</button>
        {shown.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && shown[i - 1] !== n - 1 && (
              <span className="px-1 text-[13px] text-[var(--faint)]">…</span>
            )}
            <button type="button" onClick={() => go(n)} aria-current={n === page ? "page" : undefined}
              className={`pager-btn ${n === page ? "pager-btn-on" : ""}`}>{n}</button>
          </span>
        ))}
        <button type="button" className="pager-btn" disabled={page >= pages}
          onClick={() => go(page + 1)}>Next</button>
      </div>
    </div>
  );
}
