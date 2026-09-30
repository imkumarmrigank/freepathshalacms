"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, isLocale } from "@/lib/locale";

/**
 * Switch the interface language. It is kept on the device rather than against
 * the account, so a teacher on a shared phone can set it for themselves.
 */
export async function setLocale(next: string) {
  if (!isLocale(next)) return;
  (await cookies()).set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
