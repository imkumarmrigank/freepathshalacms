"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function AttendancePicker({
  centers, classes, defaults,
}: {
  centers: { id: number; code: string; name: string }[];
  classes: { id: number; name: string }[];
  defaults: { center: string; class: string; date: string };
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    start(() => router.replace(`${path}?${next.toString()}`));
  };

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
      {centers.length > 0 && (
        <label>
          <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Centre</span>
          <select className="select" value={defaults.center} onChange={(e) => set("center", e.target.value)}>
            <option value="">Select centre</option>
            {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
        </label>
      )}
      <label>
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Class</span>
        <select className="select" value={defaults.class} onChange={(e) => set("class", e.target.value)}>
          <option value="">Select class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Date</span>
        <input className="input" type="date" value={defaults.date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => set("date", e.target.value)} />
      </label>
    </div>
  );
}
