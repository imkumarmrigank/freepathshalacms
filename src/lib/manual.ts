import "server-only";
import { one, query } from "./db";
import type { Role } from "./roles";

/**
 * The training manual, held in the database so the super admin can correct it
 * without a deploy.
 *
 * Two pairs of roles share a manual — a backup teacher does a teacher's job,
 * and an admin does a super admin's minus the yearly settings — so they share
 * a row rather than drifting apart as two copies of nearly the same text.
 */

export type Note = { kind: "warn" | "stop"; title: string; body: string };

export type Task = {
  id: number;
  position: number;
  title: string;
  why: string | null;
  path: string[];
  steps: string[];
  notes: Note[];
  /** File name under /public/manual, without the extension. */
  shot: string | null;
  superAdminOnly: boolean;
};

export type Pitfall = { id: number; position: number; problem: string; meaning: string };

export type Manual = {
  key: ManualKey;
  headline: string;
  intro: string[];
  routine: { title: string; items: string[] };
  tasks: Task[];
  pitfalls: Pitfall[];
};

/** The four manuals that exist. */
export const MANUAL_KEYS = ["teacher", "center_manager", "mentor", "admin"] as const;
export type ManualKey = (typeof MANUAL_KEYS)[number];

export const MANUAL_LABEL: Record<ManualKey, string> = {
  teacher: "Teacher",
  center_manager: "Centre Manager",
  mentor: "Mentor",
  admin: "Administrator",
};

/** Who reads which one. */
export const MANUAL_AUDIENCE: Record<ManualKey, string> = {
  teacher: "Teachers and backup teachers",
  center_manager: "Centre managers",
  mentor: "Mentors",
  admin: "Admins and super admins",
};

const OF_ROLE: Record<Role, ManualKey> = {
  teacher: "teacher",
  backup_teacher: "teacher",
  center_manager: "center_manager",
  mentor: "mentor",
  admin: "admin",
  super_admin: "admin",
};

export function manualKeyFor(role: Role): ManualKey {
  return OF_ROLE[role];
}

export function isManualKey(v: string): v is ManualKey {
  return (MANUAL_KEYS as readonly string[]).includes(v);
}

/** Everything one manual needs, in one round trip per table. */
export async function loadManual(key: ManualKey): Promise<Manual> {
  const [intro, tasks, pitfalls] = await Promise.all([
    one<{
      headline: string; intro: string[]; routine_title: string; routine_items: string[];
    }>(
      `SELECT headline, intro, routine_title, routine_items
         FROM manual_intro WHERE role = $1`, [key]),
    query<{
      id: number; position: number; title: string; why: string | null;
      path: string[]; steps: string[]; notes: Note[];
      shot: string | null; super_admin_only: boolean;
    }>(
      `SELECT id, position, title, why, path, steps, notes, shot, super_admin_only
         FROM manual_tasks WHERE role = $1 ORDER BY position, id`, [key]),
    query<Pitfall>(
      `SELECT id, position, problem, meaning
         FROM manual_pitfalls WHERE role = $1 ORDER BY position, id`, [key]),
  ]);

  return {
    key,
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
