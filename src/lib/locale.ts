import hi from "./dict/hi";

/**
 * The language of the interface, and how a line is looked up — the half of
 * the machinery that both halves of the app can hold. Reading the choice off
 * the request needs the server, and lives in i18n.ts.
 *
 * The key is the English sentence itself, so a screen that has not been
 * translated yet still reads correctly: it falls through to the key. A
 * translation is added by writing one line in the dictionary, without
 * touching the screen.
 *
 * What people type — a centre's name, a child's name, a teacher's own note —
 * is theirs, and is never translated.
 */
export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAME: Record<Locale, string> = { en: "English", hi: "हिंदी" };
export const LOCALE_SHORT: Record<Locale, string> = { en: "EN", hi: "हिं" };
export const LOCALE_COOKIE = "rv_lang";

export type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = { en: {}, hi };

export function isLocale(v: string | undefined | null): v is Locale {
  return v === "en" || v === "hi";
}

/** Look a line up, falling back to the English it was written in. */
export function translator(locale: Locale) {
  const d = DICTS[locale] ?? {};
  return (en: string, vars?: Record<string, string | number>) => {
    let out = d[en] ?? en;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}

export type T = ReturnType<typeof translator>;

/** The whole dictionary, for handing to the client half of the app. */
export function dictFor(locale: Locale): Dict {
  return DICTS[locale] ?? {};
}
