"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { LANGUAGES } from "@/lib/manual-meta";

/**
 * Only languages the manual has actually been written in are offered. A choice
 * that quietly returned English would teach people the switcher is broken.
 */
export default function LanguagePicker({ available, current }: {
  available: string[]; current: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  if (available.length < 2) return null;

  const choose = (code: string) => {
    const next = new URLSearchParams(params.toString());
    if (code === "en") next.delete("lang"); else next.set("lang", code);
    try { localStorage.setItem("fp-manual-lang", code); } catch { /* fine */ }
    start(() => router.replace(`${path}?${next.toString()}`));
  };

  return (
    <div className={`no-print flex flex-wrap gap-1.5 ${pending ? "opacity-60" : ""}`}>
      {LANGUAGES.filter((l) => available.includes(l.code)).map((l) => (
        <button key={l.code} type="button" onClick={() => choose(l.code)}
          lang={l.code}
          aria-current={l.code === current ? "true" : undefined}
          className={`btn btn-sm ${l.code === current ? "btn-primary" : "btn-ghost"}`}>
          {l.native}
        </button>
      ))}
    </div>
  );
}
