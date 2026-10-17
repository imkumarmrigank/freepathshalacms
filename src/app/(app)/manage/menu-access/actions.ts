"use server";

import { requireUser } from "@/lib/auth";
import { replaceOverridesForUser, ensureMenuOverridesTable } from "@/lib/menu-overrides";
import { revalidatePath } from "next/cache";

export async function saveMenuAccess(_prev: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (user.role !== "super_admin") return { error: "Only super admin can manage menu access." };

  const userId = Number(form.get("user_id"));
  if (!userId) return { error: "No user selected." };

  // All visible checkboxes from the form are "show"; those absent are "hidden"
  // The form sends every possible key as a hidden input so we know the full set
  const allKeys = form.getAll("all_keys").map(String);
  const checkedKeys = new Set(form.getAll("visible_key").map(String));
  const hiddenKeys = allKeys.filter((k) => !checkedKeys.has(k));

  await ensureMenuOverridesTable();
  await replaceOverridesForUser(userId, hiddenKeys);
  revalidatePath("/manage/menu-access");
  return { ok: true };
}
