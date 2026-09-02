import type { ReactNode } from "react";
import { INK } from "@/lib/chart-palette";

export type Point = { label: string; value: number; hint?: string };
export type Series = { key: string; label: string; color: string };
export type StackRow = { label: string; parts: Record<string, number>; hint?: string };

/* ----------------------------------------------------------------- frame */

export function ChartFrame({
  title, subtitle, series, children, table, empty,
}: {
  title: string;
  subtitle?: string;
  series?: Series[];
  children: ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  empty?: boolean;
}) {
  return (
    <div className="card card-pad">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {series && series.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                <span className="h-2.5 w-2.5 flex-none rounded-[3px]"
                  style={{ background: s.color }} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {subtitle && <p className="mb-3 text-[13px] text-[var(--muted)]">{subtitle}</p>}

      {empty ? (
        <p className="rounded-[9px] bg-[#fafaff] px-3.5 py-6 text-center text-[13px] text-[var(--muted)]">
          Nothing to chart for these filters yet.
        </p>
      ) : (
        <>
          {children}
          {table && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[12px] text-[var(--muted)] hover:text-[var(--brand)]">
                View as a table
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>{table.head.map((h, i) => (
                      <th key={h} className={i > 0 ? "text-right" : ""}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j} className={j > 0 ? "text-right tabular-nums" : ""}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/** Nice round upper bound so gridlines land on readable numbers. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function gridLines(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/* ------------------------------------------------------------ column bar */

export function BarChart({
  data, color, height = 190, suffix = "", labelEvery = 1,
}: { data: Point[]; color: string; height?: number; suffix?: string; labelEvery?: number }) {
  const W = 720, PL = 42, PR = 10, PT = 12, PB = 30;
  const plotW = W - PL - PR, plotH = height - PT - PB;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = plotW / Math.max(data.length, 1);
  const bw = Math.min(46, slot * 0.62);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img"
      style={{ maxHeight: height + 10 }}>
      {gridLines(max).map((g) => {
        const y = PT + plotH - (g / max) * plotH;
        return (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={INK.grid} strokeWidth={1} />
            <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={INK.muted}>
              {Math.round(g)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = max > 0 ? (d.value / max) * plotH : 0;
        const x = PL + i * slot + (slot - bw) / 2;
        const y = PT + plotH - h;
        return (
          <g key={d.label}>
            {/* 4px rounded data-end, anchored to the baseline */}
            <rect x={x} y={y} width={bw} height={Math.max(h, d.value > 0 ? 2 : 0)}
              rx={4} ry={4} fill={color}>
              <title>{`${d.label}: ${d.value}${suffix}${d.hint ? ` — ${d.hint}` : ""}`}</title>
            </rect>
            {h > 0 && (
              <rect x={x} y={Math.min(y + 4, PT + plotH - 1)} width={bw}
                height={Math.max(h - 4, 1)} fill={color}>
                <title>{`${d.label}: ${d.value}${suffix}`}</title>
              </rect>
            )}
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize={11}
                fill={INK.secondary} fontWeight={500}>
                {d.value}{suffix}
              </text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + bw / 2} y={height - 10} textAnchor="middle" fontSize={11} fill={INK.muted}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={PT + plotH} y2={PT + plotH} stroke={INK.axis} strokeWidth={1} />
    </svg>
  );
}

/* --------------------------------------------------------- stacked bars */

export function StackedBarChart({
  data, series, height = 210, suffix = "",
}: { data: StackRow[]; series: Series[]; height?: number; suffix?: string }) {
  const W = 720, PL = 42, PR = 10, PT = 12, PB = 30;
  const plotW = W - PL - PR, plotH = height - PT - PB;
  const totals = data.map((d) => series.reduce((n, s) => n + (d.parts[s.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const slot = plotW / Math.max(data.length, 1);
  const bw = Math.min(52, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img"
      style={{ maxHeight: height + 10 }}>
      {gridLines(max).map((g) => {
        const y = PT + plotH - (g / max) * plotH;
        return (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={INK.grid} strokeWidth={1} />
            <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={INK.muted}>
              {Math.round(g)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = PL + i * slot + (slot - bw) / 2;
        let cursor = PT + plotH;
        return (
          <g key={d.label}>
            {series.map((s) => {
              const v = d.parts[s.key] ?? 0;
              if (v <= 0) return null;
              const h = (v / max) * plotH;
              cursor -= h;
              return (
                // 2px surface gap between segments
                <rect key={s.key} x={x} y={cursor + 1} width={bw} height={Math.max(h - 2, 1)}
                  rx={2} fill={s.color}>
                  <title>{`${d.label} · ${s.label}: ${v}${suffix}`}</title>
                </rect>
              );
            })}
            {totals[i] > 0 && (
              <text x={x + bw / 2} y={PT + plotH - (totals[i] / max) * plotH - 5}
                textAnchor="middle" fontSize={11} fill={INK.secondary} fontWeight={500}>
                {totals[i]}
              </text>
            )}
            <text x={x + bw / 2} y={height - 10} textAnchor="middle" fontSize={11} fill={INK.muted}>
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={PT + plotH} y2={PT + plotH} stroke={INK.axis} strokeWidth={1} />
    </svg>
  );
}

/* ------------------------------------------------------------ line/area */

export function LineChart({
  data, color, height = 200, suffix = "%", yMax,
}: { data: Point[]; color: string; height?: number; suffix?: string; yMax?: number }) {
  const W = 720, PL = 42, PR = 12, PT = 14, PB = 30;
  const plotW = W - PL - PR, plotH = height - PT - PB;
  const max = yMax ?? niceMax(Math.max(...data.map((d) => d.value), 0));
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  const xy = (d: Point, i: number) => [
    PL + i * step,
    PT + plotH - (max > 0 ? (d.value / max) * plotH : 0),
  ] as const;

  const path = data.map((d, i) => { const [x, y] = xy(d, i); return `${i ? "L" : "M"}${x},${y}`; }).join(" ");
  const area = `${path} L${PL + (data.length - 1) * step},${PT + plotH} L${PL},${PT + plotH} Z`;
  const every = Math.max(1, Math.ceil(data.length / 12));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img"
      style={{ maxHeight: height + 10 }}>
      {gridLines(max).map((g) => {
        const y = PT + plotH - (g / max) * plotH;
        return (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={INK.grid} strokeWidth={1} />
            <text x={PL - 8} y={y + 4} textAnchor="end" fontSize={11} fill={INK.muted}>
              {Math.round(g)}{suffix}
            </text>
          </g>
        );
      })}
      {data.length > 1 && <path d={area} fill={color} opacity={0.09} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const [x, y] = xy(d, i);
        return (
          <g key={d.label}>
            {/* generous hit target, 2px surface ring on the visible marker */}
            <circle cx={x} cy={y} r={9} fill="transparent">
              <title>{`${d.label}: ${d.value}${suffix}${d.hint ? ` — ${d.hint}` : ""}`}</title>
            </circle>
            {(i % every === 0 || i === data.length - 1) && (
              <circle cx={x} cy={y} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
            )}
            {i % every === 0 && (
              <text x={x} y={height - 10} textAnchor="middle" fontSize={11} fill={INK.muted}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={PT + plotH} y2={PT + plotH} stroke={INK.axis} strokeWidth={1} />
    </svg>
  );
}

/* -------------------------------------------------------- horizontal bar */

export function HBarChart({
  data, color, suffix = "",
}: { data: Point[]; color: string; suffix?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3" title={`${d.label}: ${d.value}${suffix}`}>
          <span className="w-[104px] flex-none truncate text-[13px] text-[var(--muted)]">{d.label}</span>
          <span className="h-[18px] flex-1 overflow-hidden rounded-[4px] bg-[#f1f1f6]">
            <span className="block h-full rounded-[4px]"
              style={{ width: `${(d.value / max) * 100}%`, background: color, minWidth: d.value > 0 ? 3 : 0 }} />
          </span>
          <span className="w-14 flex-none text-right text-[13px] font-medium tabular-nums">
            {d.value}{suffix}
          </span>
        </li>
      ))}
    </ul>
  );
}
