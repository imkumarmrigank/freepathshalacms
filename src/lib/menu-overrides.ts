import { query } from "@/lib/db";
import { type Role } from "@/lib/roles";

/** Create the table if it doesn't exist yet (idempotent). */
export async function ensureMenuOverridesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS role_menu_overrides (
      id         SERIAL PRIMARY KEY,
      role       TEXT NOT NULL,
      menu_key   TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (role, menu_key)
    )
  `);
}

type RoleOverrides = { hidden: Set<string>; granted: Set<string> };

/** Hidden keys (hide despite role gate) and granted keys (show despite no role gate). */
export async function overridesForRole(role: Role): Promise<RoleOverrides> {
  try {
    const rows = await query<{ menu_key: string; hidden: boolean }>(
      "SELECT menu_key, hidden FROM role_menu_overrides WHERE role = $1",
      [role],
    );
    const hidden = new Set(rows.filter((r) => r.hidden).map((r) => r.menu_key));
    const granted = new Set(rows.filter((r) => !r.hidden).map((r) => r.menu_key));
    return { hidden, granted };
  } catch {
    return { hidden: new Set(), granted: new Set() };
  }
}

/** For the management UI: keys marked hidden and keys marked granted. */
export async function overrideArraysForRole(
  role: Role,
): Promise<{ hiddenKeys: string[]; grantedKeys: string[] }> {
  try {
    const rows = await query<{ menu_key: string; hidden: boolean }>(
      "SELECT menu_key, hidden FROM role_menu_overrides WHERE role = $1 ORDER BY menu_key",
      [role],
    );
    return {
      hiddenKeys: rows.filter((r) => r.hidden).map((r) => r.menu_key),
      grantedKeys: rows.filter((r) => !r.hidden).map((r) => r.menu_key),
    };
  } catch {
    return { hiddenKeys: [], grantedKeys: [] };
  }
}

/**
 * Bulk replace all overrides for a role.
 * hiddenKeys  = items the role normally has but we want to hide
 * grantedKeys = items the role normally lacks but we want to show
 */
export async function replaceOverridesForRole(
  role: Role,
  hiddenKeys: string[],
  grantedKeys: string[],
) {
  await query("DELETE FROM role_menu_overrides WHERE role = $1", [role]);
  const all = [
    ...hiddenKeys.map((k) => ({ key: k, hidden: true })),
    ...grantedKeys.map((k) => ({ key: k, hidden: false })),
  ];
  if (all.length === 0) return;
  const values = all.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}, now())`).join(", ");
  const params: unknown[] = [role];
  for (const { key, hidden } of all) params.push(key, hidden);
  await query(
    `INSERT INTO role_menu_overrides (role, menu_key, hidden, updated_at) VALUES ${values}`,
    params,
  );
}
