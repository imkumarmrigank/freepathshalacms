/**
 * The shapes and lists the manual is made of.
 *
 * Split from the loader because the language picker and the editors run in the
 * browser, and the loader is server-only — importing it from a client component
 * fails the build.
 */
import type { Role } from "./roles";

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
  lang: string;
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

/**
 * The languages a manual may be written in. Staff at the centres read Hindi
 * first; the rest are here because the centres draw people from several states
 * and a manual nobody can read is not a manual.
 */
export const LANGUAGES = [
  { code: "en", label: "English",  native: "English" },
  { code: "hi", label: "Hindi",    native: "हिन्दी" },
  { code: "bn", label: "Bengali",  native: "বাংলা" },
  { code: "or", label: "Odia",     native: "ଓଡ଼ିଆ" },
  { code: "mr", label: "Marathi",  native: "मराठी" },
  { code: "pa", label: "Punjabi",  native: "ਪੰਜਾਬੀ" },
  { code: "ta", label: "Tamil",    native: "தமிழ்" },
  { code: "te", label: "Telugu",   native: "తెలుగు" },
  { code: "kn", label: "Kannada",  native: "ಕನ್ನಡ" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "ur", label: "Urdu",     native: "اُردُو" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export function isLang(v: string | undefined | null): v is LangCode {
  return Boolean(v) && LANGUAGES.some((l) => l.code === v);
}

export function langLabel(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}

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

