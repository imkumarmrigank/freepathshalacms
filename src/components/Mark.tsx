import { markWord, outOfFive } from "@/lib/audit-meta";

/**
 * A visit's overall mark out of 5. The percentage is the same judgement, but
 * a mark is what people compare centres on, so the mark leads and the
 * percentage sits under it.
 */
export default function Mark({ pct, size = "md" }: {
  pct: number | string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const mark = outOfFive(pct);
  if (mark == null) return <span className="text-[var(--faint)]">—</span>;
  const tone = mark >= 4 ? "text-[var(--ok)]"
    : mark >= 3 ? "text-[var(--brand)]"
    : mark >= 2 ? "text-[#7a5a12]" : "text-[var(--bad)]";
  const big = size === "lg" ? "text-[22px]" : size === "sm" ? "text-[13px]" : "text-[15px]";
  return (
    <span className="inline-flex items-baseline gap-1.5"
      title={`${markWord(mark)} — ${Math.round(Number(pct))}% of the points this visit could score`}>
      <b className={`${big} ${tone} tabular-nums`}>{mark.toFixed(1)}</b>
      <span className="text-[11.5px] text-[var(--muted)]">
        / 5
        {size !== "sm" && ` · ${Math.round(Number(pct))}%`}
      </span>
    </span>
  );
}
