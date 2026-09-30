"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAME, LOCALE_SHORT, type Locale } from "@/lib/locale";
import { setLocale } from "@/app/locale-action";
import { useLocale } from "./LocaleProvider";

/**
 * English or Hindi, for the whole system. It is two words rather than a menu
 * because there are two languages and a teacher should not have to hunt.
 */
export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const pick = (next: Locale) => {
    if (next === locale || pending) return;
    start(async () => { await setLocale(next); router.refresh(); });
  };

  return (
    <div className={`inline-flex items-center rounded-full border border-[var(--border)]
      bg-white p-[2px] ${pending ? "opacity-60" : ""}`}
      role="group" aria-label="Language / भाषा">
      {LOCALES.map((l) => (
        <button key={l} type="button" onClick={() => pick(l)} aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-[3px] text-[12px] transition ${locale === l
            ? "bg-[var(--brand)] text-white"
            : "text-[var(--muted)] hover:text-[var(--ink)]"}`}>
          {compact ? LOCALE_SHORT[l] : LOCALE_NAME[l]}
        </button>
      ))}
    </div>
  );
}
