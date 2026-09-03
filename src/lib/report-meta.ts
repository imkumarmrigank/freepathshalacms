import type { Role } from "./roles";

/** Report catalogue — shared by the page, the client filters and the export route. */
export type ReportFilter =
  | "dates" | "center" | "class" | "session" | "role"
  /** Day, week or month — how the rows of a running report are bucketed. */
  | "groupBy";

/** The buckets a cumulative attendance report can be added up over. */
export const GROUP_BY = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
] as const;

export type GroupBy = (typeof GROUP_BY)[number]["value"];

export function groupByOf(v: string | null | undefined): GroupBy {
  return v === "week" || v === "month" ? v : "day";
}

export type ReportMeta = {
  key: string;
  label: string;
  group: string;
  description: string;
  filters: ReportFilter[];
  /** Only these roles may run it; omitted means everyone with reports access. */
  roles?: Role[];
};

export const REPORTS: ReportMeta[] = [
  {
    key: "student-attendance-summary",
    label: "Student attendance summary",
    group: "Attendance",
    description:
      "One row per student for the chosen period: days present, absent, late, on leave, and the attendance percentage.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "student-attendance-register",
    label: "Student attendance register",
    group: "Attendance",
    description:
      "The day-by-day register — students down the side, dates across the top. Best for a week or a month.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "student-attendance-trend",
    label: "Student attendance over time",
    group: "Attendance",
    description:
      "Attendance added up day by day, week by week or month by month, one line per centre, "
      + "with the running total across the whole period.",
    filters: ["dates", "center", "class", "session", "groupBy"],
  },
  {
    key: "staff-attendance-trend",
    label: "Staff attendance over time",
    group: "Attendance",
    description:
      "The same for teachers and centre managers: how many were on duty each day, week or month, "
      + "centre by centre, with the running total.",
    filters: ["dates", "center", "role", "groupBy"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "staff-attendance-summary",
    label: "Staff attendance summary",
    group: "Attendance",
    description:
      "Teachers and centre managers: days present, late, absent and hours logged over the period.",
    filters: ["dates", "center", "role"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "staff-attendance-detail",
    label: "Staff attendance — day by day",
    group: "Attendance",
    description:
      "Every punch in the period with times, hours, distance from the centre and any manual override.",
    filters: ["dates", "center", "role"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "students-by-class",
    label: "Students by class and centre",
    group: "Students",
    description: "Head count for each class at each centre, with boys/girls and the centre total.",
    filters: ["center", "session"],
  },
  {
    key: "student-roster",
    label: "Student roster",
    group: "Students",
    description:
      "The full list with enrolment number, class, parents, phone, admission date and attendance so far.",
    filters: ["center", "class", "session"],
  },
  {
    key: "admissions",
    label: "Admissions in the period",
    group: "Students",
    description: "Who joined between the two dates, and whether it was a new or mid-session admission.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "supplies-stock",
    label: "Supplies stock by centre",
    group: "Supplies",
    description: "Received, given out and in hand for every item, centre by centre.",
    filters: ["center"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "hq-stock",
    label: "Headquarters stock",
    group: "Supplies",
    description:
      "What has been received at headquarters, what has gone out to centres, and what is left.",
    filters: [],
    roles: ["super_admin", "admin"],
  },
  {
    key: "hq-receipts",
    label: "Goods received at HQ",
    group: "Supplies",
    description:
      "Every consignment received at headquarters — item, quantity, supplier, invoice, unit cost and value.",
    filters: ["dates"],
    roles: ["super_admin", "admin"],
  },
  {
    key: "supplies-dispatched",
    label: "Supplies sent to centres",
    group: "Supplies",
    description:
      "Every dispatch from headquarters to a centre — date, centre, item, quantity, challan and value.",
    filters: ["dates", "center"],
    roles: ["super_admin", "admin"],
  },
  {
    key: "supplies-by-centre",
    label: "Centre-wise supply position",
    group: "Supplies",
    description:
      "For each centre and item: how much was sent, how much reached students, and what is still in hand.",
    filters: ["center"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "supplies-issued",
    label: "Supplies given to students",
    group: "Supplies",
    description: "Every issue in the period — student, item, quantity and who handed it over.",
    filters: ["dates", "center"],
    roles: ["super_admin", "admin", "center_manager"],
  },
  {
    key: "exam-marks",
    label: "Marks sheet",
    group: "Tests",
    description:
      "Every student's marks for each test in the period — subject, maximum, obtained, percentage and grade.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "exam-summary",
    label: "Test summary",
    group: "Tests",
    description:
      "One row per test: how many were graded, the class average, highest and lowest, and how many passed.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "ptm-summary",
    label: "PTM and follow-ups",
    group: "PTM",
    description:
      "Interactions in the period by centre and class, parent engagement, and follow-ups still open.",
    filters: ["dates", "center", "class", "session"],
  },
  {
    key: "teaching-plan-progress",
    label: "Teaching plan progress",
    group: "Teaching",
    description:
      "Each plan with its topics, how many are taught, whether it was submitted, and issues logged.",
    filters: ["center", "class", "session"],
  },
  {
    key: "timetable",
    label: "Timetable",
    group: "Teaching",
    description: "The full weekly grid as a list — class, day, period, subject and teacher.",
    filters: ["center", "class", "session"],
  },
];

export const REPORT_GROUPS = [...new Set(REPORTS.map((r) => r.group))];

export function reportByKey(key: string) {
  return REPORTS.find((r) => r.key === key);
}
