/**
 * What each role is asked at the end of the day.
 *
 * The questions are the work: a mentor is asked about families and homes, an
 * auditor about what was checked and what cannot wait, a coach about the
 * session and the equipment. Shared by the form, the panel and the report, so
 * a field is described once and read the same way everywhere.
 */
/** The columns, for a query that reads a whole note. */
export const NOTE_COLUMNS = [
  "summary", "where_worked", "plan_next", "support_needed",
  "families_met", "home_visits", "concerns", "follow_ups",
  "what_checked", "findings", "urgent_issues", "told_to_centre",
  "sports_covered", "activities", "children_count", "equipment_used",
  "equipment_need", "talent_spotted", "injuries",
] as const;

export type NoteName = (typeof NOTE_COLUMNS)[number];

export type NoteField = {
  name: NoteName;
  label: string;
  hint?: string;
  rows?: number;
  /** a number rather than words — only the count of children so far */
  numeric?: boolean;
};

const COMMON_TOP: NoteField[] = [
  { name: "summary", label: "What you did today", rows: 3,
    hint: "the day in a few lines — हिंदी या English" },
  { name: "where_worked", label: "Where you worked",
    hint: "the centres, the basti, the ground" },
];

const COMMON_BOTTOM: NoteField[] = [
  { name: "plan_next", label: "What is planned next", rows: 2,
    hint: "tomorrow, or the next visit" },
  { name: "support_needed", label: "Help you need", rows: 2,
    hint: "what the office should know" },
];

export const NOTE_FIELDS: Record<string, NoteField[]> = {
  mentor: [
    ...COMMON_TOP,
    { name: "families_met", label: "Families you met", rows: 2,
      hint: "who was seen, and where" },
    { name: "home_visits", label: "Homes you went to", rows: 2,
      hint: "whose house, and why" },
    { name: "concerns", label: "What the parents raised", rows: 2 },
    { name: "follow_ups", label: "What was promised", rows: 2,
      hint: "by the parents, and by you" },
    ...COMMON_BOTTOM,
  ],
  auditor: [
    ...COMMON_TOP,
    { name: "what_checked", label: "What you checked", rows: 2,
      hint: "the register, the food, the toilets, the teaching" },
    { name: "findings", label: "What you found", rows: 3 },
    { name: "urgent_issues", label: "What cannot wait", rows: 2,
      hint: "anything needing the office today" },
    { name: "told_to_centre", label: "What you told the centre", rows: 2,
      hint: "said on the spot, before the report" },
    ...COMMON_BOTTOM,
  ],
  sports_teacher: [
    ...COMMON_TOP,
    { name: "sports_covered", label: "Sports and groups covered",
      hint: "kabaddi, kho-kho, the under-10s" },
    { name: "activities", label: "What was played or drilled", rows: 2 },
    { name: "children_count", label: "Children who took part", numeric: true },
    { name: "equipment_used", label: "Equipment used" },
    { name: "equipment_need", label: "Equipment missing or broken", rows: 2,
      hint: "what to send, and to which centre" },
    { name: "talent_spotted", label: "A child worth following", rows: 2,
      hint: "name them, and say what you saw" },
    { name: "injuries", label: "Anything that happened", rows: 2,
      hint: "a fall, a knock — however small" },
    ...COMMON_BOTTOM,
  ],
};

/** Which roles keep a day book of this kind. */
export const NOTE_ROLES = Object.keys(NOTE_FIELDS);

export type StaffNote = {
  id: number; role: string; on_date: string; updated_at: string;
} & Partial<Record<(typeof NOTE_COLUMNS)[number], string | number | null>>;

/** The label a field was asked under, for showing a note back. */
export function labelFor(role: string, field: string) {
  return NOTE_FIELDS[role]?.find((f) => f.name === field)?.label ?? field;
}
