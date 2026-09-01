"use client";
import { useFormStatus } from "react-dom";

export function Submit({ children = "Save", className = "btn btn-primary" }:
  { children?: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } | null }) {
  if (!state?.error && !state?.ok) return null;
  const bad = Boolean(state.error);
  return (
    <div className={`mb-4 rounded-[9px] px-3.5 py-2.5 text-[13px] ${
      bad ? "bg-[var(--bad-soft)] text-[#b91c1c]" : "bg-[var(--ok-soft)] text-[#15803d]"}`}>
      {state.error ?? state.ok}
    </div>
  );
}
