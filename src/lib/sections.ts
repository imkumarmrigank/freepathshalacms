/** The two sections every class runs in. Shared by server and client. */
export const SECTIONS = [
  { value: "M", label: "M" },
  { value: "E", label: "E" },
] as const;

export type Section = (typeof SECTIONS)[number]["value"];

export function isSection(v: unknown): v is Section {
  return v === "M" || v === "E";
}

/** Anything that is not E is M — the default every child starts in. */
export function sectionOr(v: unknown): Section {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "E" ? "E" : "M";
}
