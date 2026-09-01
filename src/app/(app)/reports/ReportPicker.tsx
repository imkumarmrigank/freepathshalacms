"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { REPORTS, REPORT_GROUPS, type ReportMeta } from "@/lib/report-meta";
import { Card } from "@/components/ui";

const PRESETS = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
];

function presetRange(key: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monday = (d: Date) => {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  };
  switch (key) {
    case "this-week": {
      const s = monday(now);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return { from: iso(s), to: iso(e) };
    }
    case "last-week": {
      const s = monday(now); s.setDate(s.getDate() - 7);
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return { from: iso(s), to: iso(e) };
    }
    case "this-month":
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    default:
      return {
        from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
  }
}

export default function ReportPicker({
  available, centers, classes, sessions, current, showCenter,
}: {
  available: ReportMeta[];
  centers: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
  sessions: { id: number; name: string; is_current: boolean }[];
  current: Record<string, string | undefined>;
  showCenter: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const activeKey = current.report ?? available[0]?.key;
  const active = available.find((r) => r.key === activeKey) ?? available[0];

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    start(() => router.replace(`/reports?${next.toString()}`));
  };

  const uses = (f: string) => active?.filters.includes(f as never);

  return (
    <div className={pending ? "opacity-60" : ""}>
      <Card className="mb-4">
        <div className="mb-3 text-[13px] font-medium text-[var(--muted)]">Choose a report</div>
        <div className="space-y-3">
          {REPORT_GROUPS.filter((g) => available.some((r) => r.group === g)).map((group) => (
            <div key={group}>
              <div className="label-cap mb-1.5">{group}</div>
              <div className="flex flex-wrap gap-2">
                {available.filter((r) => r.group === group).map((r) => (
                  <button key={r.key} type="button"
                    onClick={() => push({ report: r.key })}
                    className={`btn btn-sm ${r.key === active?.key ? "btn-primary" : "btn-ghost"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {active && (
          <p className="mt-4 border-t border-[var(--border)] pt-3 text-[13px] text-[var(--muted)]">
            {active.description}
          </p>
        )}
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {uses("dates") && (
            <>
              <label>
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">From</span>
                <input className="input w-auto" type="date" value={current.from ?? ""}
                  onChange={(e) => push({ from: e.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">To</span>
                <input className="input w-auto" type="date" value={current.to ?? ""}
                  onChange={(e) => push({ to: e.target.value })} />
              </label>
              <div className="flex gap-1.5 pb-[1px]">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" className="btn btn-ghost btn-sm h-[38px]"
                    onClick={() => push(presetRange(p.key))}>
                    {p.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {uses("session") && sessions.length > 0 && (
            <label>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Session</span>
              <select className="select w-auto" value={current.session ?? ""}
                onChange={(e) => push({ session: e.target.value })}>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
                ))}
              </select>
            </label>
          )}

          {uses("center") && showCenter && (
            <label>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Centre</span>
              <select className="select w-auto" value={current.center ?? ""}
                onChange={(e) => push({ center: e.target.value })}>
                <option value="">All centres</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
              </select>
            </label>
          )}

          {uses("class") && (
            <label>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Class</span>
              <select className="select w-auto" value={current.class ?? ""}
                onChange={(e) => push({ class: e.target.value })}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          {uses("role") && (
            <label>
              <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Staff</span>
              <select className="select w-auto" value={current.role ?? ""}
                onChange={(e) => push({ role: e.target.value })}>
                <option value="">Teachers and managers</option>
                <option value="teacher">Teachers only</option>
                <option value="center_manager">Centre managers only</option>
              </select>
            </label>
          )}
        </div>
      </Card>
    </div>
  );
}
