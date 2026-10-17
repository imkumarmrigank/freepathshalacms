"use server";

import { requireUser } from "@/lib/auth";
import { replaceOverridesForRole, ensureMenuOverridesTable } from "@/lib/menu-overrides";
import { type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function saveMenuAccess(_prev: unknown, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  if (user.role !== "super_admin") return { error: "Only super admin can manage menu access." };

  const role = form.get("role") as Role | null;
  if (!role) return { error: "No role selected." };

  const allKeys = form.getAll("all_keys").map(String);
  const checkedKeys = new Set(form.getAll("visible_key").map(String));
  const hiddenKeys = allKeys.filter((k) => !checkedKeys.has(k));

  await ensureMenuOverridesTable();
  await replaceOverridesForRole(role, hiddenKeys);
  revalidatePath("/manage/menu-access");
  return { ok: true };
}
