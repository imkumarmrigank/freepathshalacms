export type Role =
  | "super_admin"
  | "admin"
  | "mentor"
  | "center_manager"
  | "teacher"
  | "backup_teacher"
  | "auditor";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  mentor: "Mentor",
  center_manager: "Centre Manager",
  teacher: "Teacher",
  backup_teacher: "Backup Teacher",
  auditor: "Auditor",
};

export const ROLE_BLURB: Record<Role, string> = {
  super_admin: "Everything, including sessions, classes, promotion and centres.",
  admin: "Every centre — students, staff, attendance, supplies and reports.",
  mentor: "Parent meetings, follow-ups and progress reports, across every centre.",
  center_manager: "One centre: its teachers, students, timetable and register.",
  teacher: "One centre: marks the register, records PTMs, writes teaching plans.",
  backup_teacher: "Stands in for an absent teacher at whichever centre is assigned.",
  auditor: "Visits centres, rates them, and leaves suggestions to act on.",
};

/** Roles that work across every centre rather than being pinned to one. */
export function isGlobalRole(role: Role) {
  return role === "super_admin" || role === "admin" || role === "mentor"
    || role === "auditor";
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
  super_admin: ["super_admin", "admin", "mentor", "center_manager", "teacher",
    "backup_teacher", "auditor"],
  admin: ["mentor", "center_manager", "teacher", "backup_teacher", "auditor"],
  mentor: [],
  center_manager: ["teacher"],
  teacher: [],
  backup_teacher: [],
  auditor: [],
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

/**
 * Declaring a holiday or a closure — the events that call off a day's teaching
 * and stop the register expecting anyone. A centre manager runs their centre
 * but does not decide it is shut, so they keep feasts, activities and events
 * and lose these two.
 */
export function canSetHolidays(role: Role) {
  return role === "super_admin" || role === "admin" || role === "mentor";
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
  | "counselling" | "teacherRemarks" | "messages"
  // audits: "audits" is the auditor's own work — rating a centre and raising
  // suggestions. "auditReports" is reading them. A centre reads its own report
  // and answers its own suggestions; it never scores itself.
  | "audits" | "auditReports";

/** One explicit list per role — no inference, so a gate is read, not deduced. */
const FEATURES: Record<Role, Feature[]> = {
  super_admin: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "centres", "coverage", "counselling", "teacherRemarks", "messages",
    "audits", "auditReports",
  ],
  admin: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "centres", "coverage", "counselling", "teacherRemarks", "messages",
    "audits", "auditReports",
  ],
  // the whole point of the mentor role is that this list is short
  mentor: [
    "ptm", "followUps", "progressReports", "students", "calendar", "statistics",
    "counselling", "teacherRemarks", "messages",
  ],
  center_manager: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "supplies", "statistics", "reports",
    "staff", "ownCheckIn", "counselling", "messages", "auditReports",
  ],
  teacher: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "reports", "ownCheckIn", "counselling", "messages",
    "auditReports",
  ],
  backup_teacher: [
    "students", "attendance", "timetable", "teachingPlans", "exams", "progressReports",
    "calendar", "ptm", "followUps", "reports", "ownCheckIn", "counselling", "messages",
    "auditReports",
  ],
  // Deliberately the shortest list in the file. An auditor judges centres; they
  // do not run one, and they see nothing of a child beyond the roll numbers on
  // the day of a visit.
  auditor: ["audits", "auditReports", "calendar", "messages"],
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

/* ---------------------------------------------------------------- audits */

/** Rates a centre and raises suggestions. Only the auditor does the visit. */
export function canConductAudit(role: Role) {
  return role === "auditor";
}

/**
 * Scheduling a visit, and appointing the auditor who makes it. Deliberately not
 * the auditor's own — an auditor who picks their own dates and centres is not
 * auditing, and a surprise visit is only a surprise if the centre cannot learn
 * of it from the person being audited.
 */
export function canScheduleVisits(role: Role) {
  return role === "super_admin" || role === "admin";
}

/** Reworking the checklist itself, and the weighting behind the award. */
export function canEditAuditCriteria(role: Role) {
  return role === "super_admin";
}

/**
 * Answering a suggestion: what the centre did about it. The manager owns the
 * item, but a teacher who did the work can say so.
 */
export function canAnswerSuggestions(role: Role) {
  return role === "center_manager" || isTeaching(role);
}

/** Reads every centre's audit history rather than just their own. */
export function seesAllAudits(role: Role) {
  return role === "super_admin" || role === "admin" || role === "auditor";
}
