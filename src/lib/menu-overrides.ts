import { query } from "@/lib/db";
import { type Role } from "@/lib/roles";

/** Create the table if it doesn't exist yet (idempotent). */
export async function ensureMenuOverridesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS role_menu_overrides (
      id         SERIAL PRIMARY KEY,
      role       TEXT NOT NULL,
      menu_key   TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (role, menu_key)
    )
  `);
}

/** All hidden menu keys for a given role (empty set = nothing hidden). */
export async function hiddenKeysForRole(role: Role): Promise<Set<string>> {
  try {
    const rows = await query<{ menu_key: string }>(
      "SELECT menu_key FROM role_menu_overrides WHERE role = $1 AND hidden = TRUE",
      [role],
    );
    return new Set(rows.map((r) => r.menu_key));
  } catch {
    return new Set();
  }
}

/** All hidden keys for a role as an array (for the management UI). */
export async function hiddenKeysArrayForRole(role: Role): Promise<string[]> {
  try {
    const rows = await query<{ menu_key: string }>(
      "SELECT menu_key FROM role_menu_overrides WHERE role = $1 AND hidden = TRUE ORDER BY menu_key",
      [role],
    );
    return rows.map((r) => r.menu_key);
  } catch {
    return [];
  }
}

/** Bulk replace: replace all overrides for a role with the given hidden keys. */
export async function replaceOverridesForRole(role: Role, hiddenKeys: string[]) {
  await query("DELETE FROM role_menu_overrides WHERE role = $1", [role]);
  if (hiddenKeys.length === 0) return;
  const values = hiddenKeys.map((k, i) => `($1, $${i + 2}, TRUE, now())`).join(", ");
  await query(
    `INSERT INTO role_menu_overrides (role, menu_key, hidden, updated_at) VALUES ${values}`,
    [role, ...hiddenKeys],
  );
}
