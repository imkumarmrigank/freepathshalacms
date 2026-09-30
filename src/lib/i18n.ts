import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, translator, type Locale, type T } from "./locale";

export * from "./locale";

/** The language this request is in. English unless the person chose otherwise. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "en";
}

/** For a server component: `const t = await getT();` then `t("Save")`. */
export async function getT(): Promise<T> {
  return translator(await getLocale());
}
