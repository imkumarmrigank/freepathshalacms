export type Role =
  | "super_admin"
  | "admin"
  | "mentor"
  | "center_manager"
  | "teacher"
  | "backup_teacher";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  mentor: "Mentor",
  center_manager: "Centre Manager",
  teacher: "Teacher",
  backup_teacher: "Backup Teacher",
};

export const ROLE_BLURB: Record<Role, string> = {
  super_admin: "Everything, including sessions, classes, promotion and centres.",
  admin: "Every centre — students, staff, attendance, supplies and reports.",
  mentor: "Parent meetings, follow-ups and progress reports, across every centre.",
  center_manager: "One centre: its teachers, students, timetable and register.",
  teacher: "One centre: marks the register, records PTMs, writes teaching plans.",
  backup_teacher: "Stands in for an absent teacher at whichever centre is assigned.",
};

/** Roles that work across every centre rather than being pinned to one. */
export function isGlobalRole(role: Role) {
  return role === "super_admin" || role === "admin" || role === "mentor";
}

/** Structural settings — sessions, classes, promotion, centres, admins. */
export function canAdminister(role: Role) {
  return role === "super_admin";
}

/** Does the day-to-day work of a class: register, marks, plans. */
export function isTeaching(role: Role) {
  return role === "teacher" || role === "backup_teacher";
}

/**
 * Who each role may create.
 *   super admin -> anyone, including admins
 *   admin       -> mentors, managers, teachers and backup teachers
 *   manager     -> teachers at their own centre
 */
export const CREATABLE_ROLES: Record<Role, Role[]> = {
  super_admin: ["super_admin", "admin", "mentor", "center_manager", "teacher", "backup_teacher"],
  admin: ["mentor", "center_manager", "teacher", "backup_teacher"],
  mentor: [],
  center_manager: ["teacher"],
  teacher: [],
  backup_teacher: [],
};

export function canCreateRole(actor: Role, target: Role) {
  return CREATABLE_ROLES[actor].includes(target);
}
export function canManageStaff(role: Role) {
  return CREATABLE_ROLES[role].length > 0;
}

/**
 * Which roles belong to one centre. Admins and mentors span the organisation, and
 * a backup teacher goes wherever they are assigned — none of them has a home centre.
 */
export function needsCentre(role: Role) {
  return role === "center_manager" || role === "teacher";
}

/** Only the super admin opens a new centre; an admin maintains existing ones. */
export function canCreateCentre(role: Role) {
  return role === "super_admin";
}

/** Centres, and the supply chain from HQ to centre to student. */
export function canManageSupplies(role: Role) {
  return can(role, "supplies");
}

/** Only HQ-level roles record goods in and dispatch them to a centre. */
export function canManageHqStock(role: Role) {
  return role === "super_admin" || role === "admin";
}

/**
 * Publishing to every centre's calendar at once — a holiday the whole
 * organisation observes. A mentor works across centres but does not set the
 * organisation's calendar, and a centre manager speaks only for their own.
 */
export function canPostToAllCentres(role: Role) {
  return role === "super_admin" || role === "admin";
}

/** Standing a backup teacher in for someone is an admin decision. */
export function canAssignCoverage(role: Role) {
  return role === "super_admin" || role === "admin";
}

/* ------------------------------------------------------------ feature gates */

/**
 * A mentor's remit is deliberately narrow, so features are named rather than
 * inferred from "is this person senior enough".
 */
export type Feature =
  | "students" | "attendance" | "timetable" | "teachingPlans" | "exams"
  | "progressReports" | "calendar" | "ptm" | "followUps" | "supplies"
  | "statistics" | "reports" | "staff" | "centres" | "coverage" | "ownCheckIn"
  | "counselling" | "teacherRemarks";

/** One explicit list per role — no inference, so a gate is read, not deduced. */
const FEATURES: Record<Role, Feature[]> = {
  super_admin: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "centres", "coverage", "counselling", "teacherRemarks",
  ],
  admin: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "centres", "coverage", "counselling", "teacherRemarks",
  ],
  // the whole point of the mentor role is that this list is short
  mentor: [
    "ptm", "followUps", "progressReports", "students", "calendar", "statistics",
    "counselling", "teacherRemarks",
  ],
  center_manager: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "ownCheckIn", "counselling",
  ],
  teacher: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "reports", "ownCheckIn", "counselling",
  ],
  backup_teacher: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "reports", "ownCheckIn", "counselling",
  ],
};

export function can(role: Role, feature: Feature): boolean {
  return FEATURES[role].includes(feature);
}

/** A mentor may read a student but never change one. */
export function canEditStudents(role: Role) {
  return role !== "mentor" && !isTeaching(role);
}

/**
 * Admitting a student. Teachers pass the details to their manager, and a mentor
 * only ever reads the roll — so this is narrower than canEditStudents.
 */
export function canAdmitStudents(role: Role) {
  return role === "super_admin" || role === "admin" || role === "center_manager";
}

/** Taking a child off the roll is an administrator's decision, never a centre's. */
export function canMarkDropout(role: Role) {
  return role === "super_admin" || role === "admin";
}
