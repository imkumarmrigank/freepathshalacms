import "server-only";
import { one, query } from "./db";
import {
  LANGUAGES, MANUAL_LABEL, type Manual, type ManualKey, type Note, type Pitfall,
  manualKeyFor,
} from "./manual-meta";

// so a server module can keep importing everything from one place
export * from "./manual-meta";

/**
 * The training manual, held in the database so the super admin can correct it
 * without a deploy.
 *
 * Two pairs of roles share a manual — a backup teacher does a teacher's job,
 * and an admin does a super admin's minus the yearly settings — so they share
 * a row rather than drifting apart as two copies of nearly the same text.
 */

/**
 * Which languages this manual has actually been written in. Only these are
 * offered, so nobody picks a language and gets English back without knowing why.
 */
export async function languagesFor(key: ManualKey): Promise<string[]> {
  const rows = await query<{ lang: string }>(
    `SELECT DISTINCT lang FROM manual_intro WHERE role = $1
      UNION SELECT DISTINCT lang FROM manual_tasks WHERE role = $1`, [key]);
  const have = new Set(rows.map((r) => r.lang));
  have.add("en");
  return LANGUAGES.filter((l) => have.has(l.code)).map((l) => l.code);
}

/**
 * Everything one manual needs, in one round trip per table.
 *
 * A part-finished translation would be worse than none — half the steps in one
 * language and half in another — so a language falls back to English as a
 * whole, and only offered languages have content in the first place.
 */
export async function loadManual(key: ManualKey, lang = "en"): Promise<Manual> {
  const written = await one<{ n: string }>(
    "SELECT count(*) AS n FROM manual_tasks WHERE role = $1 AND lang = $2", [key, lang]);
  const use = Number(written?.n ?? 0) > 0 ? lang : "en";

  const [intro, tasks, pitfalls] = await Promise.all([
    one<{
      headline: string; intro: string[]; routine_title: string; routine_items: string[];
    }>(
      `SELECT headline, intro, routine_title, routine_items
         FROM manual_intro WHERE role = $1 AND lang = $2`, [key, use]),
    query<{
      id: number; position: number; title: string; why: string | null;
      path: string[]; steps: string[]; notes: Note[];
      shot: string | null; super_admin_only: boolean;
    }>(
      `SELECT id, position, title, why, path, steps, notes, shot, super_admin_only
         FROM manual_tasks WHERE role = $1 AND lang = $2 ORDER BY position, id`,
      [key, use]),
    query<Pitfall>(
      `SELECT id, position, problem, meaning
         FROM manual_pitfalls WHERE role = $1 AND lang = $2 ORDER BY position, id`,
      [key, use]),
  ]);

  return {
    key,
    lang: use,
    headline: intro?.headline ?? MANUAL_LABEL[key],
    intro: intro?.intro ?? [],
    routine: {
      title: intro?.routine_title ?? "Every day",
      items: intro?.routine_items ?? [],
    },
    tasks: tasks.map((t) => ({
      id: t.id,
      position: t.position,
      title: t.title,
      why: t.why,
      path: t.path ?? [],
      steps: t.steps ?? [],
      notes: Array.isArray(t.notes) ? t.notes : [],
      shot: t.shot,
      superAdminOnly: t.super_admin_only,
    })),
    pitfalls,
  };
}
