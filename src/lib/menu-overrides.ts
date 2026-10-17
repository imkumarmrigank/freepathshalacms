import { query } from "@/lib/db";

export type MenuOverride = { menu_key: string; hidden: boolean };

/** Create the table if it doesn't exist yet (idempotent). */
export async function ensureMenuOverridesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_menu_overrides (
      id         SERIAL PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      menu_key   TEXT NOT NULL,
      hidden     BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, menu_key)
    )
  `);
}

/** All hidden menu keys for a given user (empty set = nothing hidden). */
export async function hiddenKeysForUser(userId: number): Promise<Set<string>> {
  try {
    const rows = await query<{ menu_key: string }>(
      "SELECT menu_key FROM user_menu_overrides WHERE user_id = $1 AND hidden = TRUE",
      [userId],
    );
    return new Set(rows.map((r) => r.menu_key));
  } catch {
    // Table not yet created — treat as no overrides
    return new Set();
  }
}

/** All overrides for a user (for the management UI). */
export async function overridesForUser(userId: number): Promise<MenuOverride[]> {
  return query<MenuOverride>(
    "SELECT menu_key, hidden FROM user_menu_overrides WHERE user_id = $1 ORDER BY menu_key",
    [userId],
  );
}

/** Upsert a single override. */
export async function setMenuOverride(userId: number, menuKey: string, hidden: boolean) {
  await query(
    `INSERT INTO user_menu_overrides (user_id, menu_key, hidden, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, menu_key) DO UPDATE SET hidden = $3, updated_at = now()`,
    [userId, menuKey, hidden],
  );
}

/** Remove all overrides for a user (reset to defaults). */
export async function clearOverridesForUser(userId: number) {
  await query("DELETE FROM user_menu_overrides WHERE user_id = $1", [userId]);
}

/** Bulk replace: replace all overrides for user with the given hidden keys. */
export async function replaceOverridesForUser(userId: number, hiddenKeys: string[]) {
  await query("DELETE FROM user_menu_overrides WHERE user_id = $1", [userId]);
  if (hiddenKeys.length === 0) return;
  const values = hiddenKeys.map((k, i) => `($1, $${i + 2}, TRUE, now())`).join(", ");
  await query(
    `INSERT INTO user_menu_overrides (user_id, menu_key, hidden, updated_at) VALUES ${values}`,
    [userId, ...hiddenKeys],
  );
}
