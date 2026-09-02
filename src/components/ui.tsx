import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function PageHeader({
  title, subtitle, right, back,
}: { title: string; subtitle?: string; right?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        {back && (
          <Link href={back.href} className="mb-1.5 inline-block text-[13px] text-[var(--muted)] hover:text-[var(--brand)]">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Card({ children, className = "", pad = true }:
  { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`card ${pad ? "card-pad" : ""} ${className}`}>{children}</div>;
}

export function StatCard({ label, value, hint, tone = "default" }:
  { label: string; value: ReactNode; hint?: string; tone?: "default" | "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[var(--bad)]" : tone === "warn" ? "text-[var(--warn)]"
    : tone === "ok" ? "text-[var(--ok)]" : "";
  return (
    <div className="card card-pad">
      <div className="label-cap">{label}</div>
      <div className={`mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] ${color}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[13px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function Avatar({ name, size = 34, src }:
  { name: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      // a plain <img>: the bytes come from our own /api/media route, already
      // shrunk on the way in, so there is nothing for the image optimiser to do
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} width={size} height={size}
        className="avatar-img" style={{ width: size, height: size }} />
    );
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

const TONES: Record<string, string> = {
  ok: "badge-ok", warn: "badge-warn", bad: "badge-bad", info: "badge-info", mute: "badge-mute",
};
export function Badge({ children, tone = "mute", dot = true }:
  { children: ReactNode; tone?: keyof typeof TONES | string; dot?: boolean }) {
  return <span className={`badge ${TONES[tone] ?? "badge-mute"} ${dot ? "" : "badge-none"}`}>{children}</span>;
}

export function Meter({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = v >= 85 ? "var(--ok)" : v >= 70 ? "#eab308" : "var(--warn)";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="meter"><span style={{ width: `${v}%`, background: color }} /></span>
      <span className="text-[13px] tabular-nums text-[var(--muted)]">{Math.round(v)}%</span>
    </span>
  );
}

export function Empty({ title, hint, action }:
  { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--muted)]">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint, wide = false }:
  { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={`field ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] font-normal text-[var(--faint)]">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = "info", children }:
  { kind?: "info" | "ok" | "bad" | "warn"; children: ReactNode }) {
  const map = {
    info: "bg-[var(--brand-soft)] text-[var(--brand)]",
    ok: "bg-[var(--ok-soft)] text-[#15803d]",
    bad: "bg-[var(--bad-soft)] text-[#b91c1c]",
    warn: "bg-[var(--warn-soft)] text-[#b45309]",
  };
  return <div className={`rounded-[9px] px-3.5 py-2.5 text-[13px] ${map[kind]}`}>{children}</div>;
}
