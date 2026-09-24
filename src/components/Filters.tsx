"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconSearch } from "./icons";

type Opt = { value: string | number; label: string };

export default function Filters({
  centers = [], classes = [], sessions = [], searchPlaceholder, extra = [], dates = false,
  current,
}: {
  centers?: { id: number; name: string; code: string }[];
  classes?: { id: number; name: string }[];
  sessions?: { id: number; name: string; is_current: boolean }[];
  searchPlaceholder?: string;
  extra?: { name: string; label: string; options: Opt[] }[];
  /** A from/to pair, for a list that is read by the period it covers. */
  dates?: boolean;
  current?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    // a new filter always starts at the first page, on every list of the page
    for (const k of [...next.keys()]) if (k === "page" || k.endsWith("page")) next.delete(k);
    // a filtered list is read for what it says now, so ask the server again
    start(() => {
      router.replace(`${path}?${next.toString()}`);
      router.refresh();
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${pending ? "opacity-60" : ""}`}>
      {searchPlaceholder && (
        <form
          className="relative min-w-[240px] flex-1"
          action={(fd) => set("q", String(fd.get("q") ?? ""))}
        >
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--faint)]" />
          <input name="q" defaultValue={params.get("q") ?? ""} placeholder={searchPlaceholder}
            className="input pl-9" />
        </form>
      )}
      {sessions.length > 1 && (
        <select className="select w-auto" value={current?.session ?? ""}
          onChange={(e) => set("session", e.target.value)}>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.is_current ? " (current)" : ""}</option>
          ))}
        </select>
      )}
      {classes.length > 0 && (
        <select className="select w-auto" value={params.get("class") ?? ""}
          onChange={(e) => set("class", e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {centers.length > 0 && (
        <select className="select w-auto" value={params.get("center") ?? ""}
          onChange={(e) => set("center", e.target.value)}>
          <option value="">All centres</option>
          {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
        </select>
      )}
      {dates && (
        <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
          <span>From</span>
          <input type="date" className="input w-auto" value={params.get("from") ?? ""}
            onChange={(e) => set("from", e.target.value)} />
          <span>to</span>
          <input type="date" className="input w-auto" value={params.get("to") ?? ""}
            onChange={(e) => set("to", e.target.value)} />
        </div>
      )}
      {extra.map((f) => (
        <select key={f.name} className="select w-auto" value={params.get(f.name) ?? ""}
          onChange={(e) => set(f.name, e.target.value)}>
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
    </div>
  );
}
