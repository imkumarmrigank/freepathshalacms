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

  // all_keys = every key shown in the UI (full menu)
  // default_keys = keys the role has by default via gates
  // checked_keys = keys the admin has checked (should be visible)
  const allKeys = form.getAll("all_keys").map(String);
  const defaultKeys = new Set(form.getAll("default_key").map(String));
  const checkedKeys = new Set(form.getAll("checked_key").map(String));

  const hiddenKeys: string[] = [];   // has default access but unchecked → hide
  const grantedKeys: string[] = [];  // no default access but checked → grant

  for (const k of allKeys) {
    const hasDefault = defaultKeys.has(k);
    const isChecked = checkedKeys.has(k);
    if (hasDefault && !isChecked) hiddenKeys.push(k);
    if (!hasDefault && isChecked) grantedKeys.push(k);
  }

  await ensureMenuOverridesTable();
  await replaceOverridesForRole(role, hiddenKeys, grantedKeys);
  revalidatePath("/manage/menu-access");
  return { ok: true };
}
