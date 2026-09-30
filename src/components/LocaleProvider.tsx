"use client";
import { createContext, useContext, useMemo } from "react";
import type { Dict, Locale } from "@/lib/locale";

const Ctx = createContext<{ locale: Locale; dict: Dict }>({ locale: "en", dict: {} });

/** Hands the chosen language to the client half of the app. */
export function LocaleProvider({ locale, dict, children }: {
  locale: Locale; dict: Dict; children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `const t = useT();` then `t("Save")`. Untranslated lines stay in English. */
export function useT() {
  const { dict } = useContext(Ctx);
  return useMemo(() =>
    (en: string, vars?: Record<string, string | number>) => {
      let out = dict[en] ?? en;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
      return out;
    }, [dict]);
}

export function useLocale() {
  return useContext(Ctx).locale;
}
