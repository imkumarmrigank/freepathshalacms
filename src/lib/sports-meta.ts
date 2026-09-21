/** Sports vocabulary — shared by the pages, the forms and the reports. */

/** Offered as suggestions when a sport is added; any other name is fine too. */
export const SUGGESTED_SPORTS = [
  "Kabaddi", "Kho-kho", "Football", "Cricket", "Athletics", "Volleyball",
  "Badminton", "Skipping", "Yoga", "Chess", "Carrom", "Dance",
] as const;

/** How far a gifted child's talent could carry them, as the sports teacher sees it. */
export const SPECIAL_LEVELS = [
  { value: "centre",   label: "Stands out at the centre" },
  { value: "district", label: "District level potential" },
  { value: "state",    label: "State level potential" },
  { value: "national", label: "National level potential" },
] as const;

export const SPECIAL_LEVEL_LABEL: Record<string, string> =
  Object.fromEntries(SPECIAL_LEVELS.map((l) => [l.value, l.label]));

export const SPECIAL_LEVEL_TONE: Record<string, string> = {
  centre: "mute", district: "warn", state: "ok", national: "ok",
};

export function isSpecialLevel(v: string) {
  return SPECIAL_LEVELS.some((l) => l.value === v);
}

export const SPORT_TABS = [
  { value: "players",    label: "Players" },
  { value: "attendance", label: "Attendance" },
  { value: "tests",      label: "Tests & marks" },
  { value: "talent",     label: "Talent" },
] as const;

export type SportTab = (typeof SPORT_TABS)[number]["value"];

export function tabOf(v: string | undefined): SportTab {
  return SPORT_TABS.some((t) => t.value === v) ? (v as SportTab) : "players";
}

export type Player = {
  student_id: number;
  first_name: string;
  last_name: string | null;
  enrollment_no: string;
  gender: string | null;
  class_name: string | null;
  joined_on: string;
  is_special: boolean;
  speciality: string | null;
  special_level: string | null;
};
