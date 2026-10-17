/**
 * Server-safe mirror of the MENU tree in Sidebar.tsx.
 * Contains only the gate data (href, roles, feature, when) — no React icons.
 * Used by server components that need to know which hrefs a role can reach.
 */
import {
  can, canAdmitStudents, readsAllAuditReports, type Feature, type Role,
} from "@/lib/roles";

type Gate = {
  roles?: Role[];
  feature?: Feature;
  when?: (role: Role) => boolean;
};

type Leaf = Gate & { href: string; label: string };
type Group = Gate & { label: string; children: TreeNode[] };
type TreeNode = Leaf | Group;

const isGroup = (n: TreeNode): n is Group => "children" in n;

function allowed(n: TreeNode, role: Role): boolean {
  if (n.roles && !n.roles.includes(role)) return false;
  if (n.feature && !can(role, n.feature)) return false;
  if (n.when && !n.when(role)) return false;
  return true;
}

const TREE: TreeNode[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/centre-today", label: "Centre today", roles: ["super_admin", "admin"] },

  {
    label: "Students", children: [
      { href: "/students", label: "All students", feature: "students" },
      { href: "/students/new", label: "New admission", when: canAdmitStudents },
      { href: "/manage/transfers", label: "Transfer students", roles: ["super_admin", "admin"] },
      { href: "/manage/suspended", label: "Suspended students", roles: ["super_admin", "admin"] },
      { href: "/manage/passed-out", label: "Passed out students", roles: ["super_admin", "admin"] },
      { href: "/progress-reports", label: "Progress reports", feature: "progressReports" },
      { href: "/manage/promotions", label: "Promotions", roles: ["super_admin"] },
    ],
  },

  {
    label: "Attendance", children: [
      { href: "/attendance/dashboard", label: "Attendance dashboard", feature: "attendance" },
      { href: "/attendance", label: "Student register", feature: "attendance" },
      { href: "/my-attendance", label: "My check-in", feature: "ownCheckIn" },
      { href: "/leave", label: "My leave", feature: "leave" },
      { href: "/manage/staff-attendance", label: "Staff attendance",
        roles: ["super_admin", "admin", "center_manager"] },
      { href: "/manage/leave", label: "Leave requests", feature: "leaveApprovals" },
    ],
  },

  {
    label: "Teaching", children: [
      { href: "/timetable", label: "Timetable", feature: "timetable" },
      { href: "/syllabus", label: "Syllabus", feature: "syllabus" },
      { href: "/teaching-plans", label: "Teaching plans", feature: "teachingPlans" },
      { href: "/exams", label: "Tests & marks", feature: "exams" },
      { href: "/my-day", label: "My day book",
        roles: ["teacher", "backup_teacher", "center_manager"] },
      { href: "/manage/teacher-day", label: "Teacher day book",
        roles: ["super_admin", "admin", "center_manager"] },
      { href: "/teacher-remarks", label: "Teacher remarks", feature: "teacherRemarks" },
    ],
  },

  {
    label: "Parents & support", children: [
      { href: "/ptm/dashboard", label: "PTM dashboard", feature: "ptm" },
      { href: "/ptm", label: "PTM interactions", feature: "ptm" },
      { href: "/ptm/daily", label: "Mentor day book",
        roles: ["super_admin", "admin", "center_manager"] },
      { href: "/follow-ups", label: "Follow-ups", feature: "followUps" },
      { href: "/counselling", label: "Counselling", feature: "counselling" },
      { href: "/counselling/flagged", label: "Flagged students", feature: "counselling" },
      { href: "/centre-feedback", label: "Centre feedback",
        roles: ["mentor", "admin", "super_admin", "center_manager"] },
    ],
  },

  {
    label: "Centre audits", feature: "auditReports", children: [
      { href: "/audits/dashboard", label: "Auditor dashboard", roles: ["super_admin", "admin"] },
      { href: "/audits/reports", label: "Audit reports",
        when: (role) => readsAllAuditReports(role) || can(role, "auditReports") },
      { href: "/audits", label: "Visits & standing", feature: "auditReports" },
      { href: "/audits/daily", label: "Auditor day book", roles: ["super_admin", "admin"] },
      { href: "/audits/suggestions", label: "Suggestions", feature: "auditReports" },
      { href: "/audits/board", label: "Best centre", feature: "auditReports" },
      { href: "/manage/audit-criteria", label: "What is checked", roles: ["super_admin"] },
    ],
  },

  {
    label: "Sports", feature: "sports", children: [
      { href: "/sports/reports", label: "Sports reports", roles: ["super_admin", "admin"] },
      { href: "/sports/daily", label: "Sports day book", roles: ["super_admin", "admin"] },
      { href: "/sports/dashboard", label: "Sports dashboard", roles: ["super_admin", "admin"] },
      { href: "/sports", label: "Sports by centre", feature: "sports" },
    ],
  },

  { href: "/calendar", label: "Calendar", feature: "calendar" },
  {
    label: "Supplies", children: [
      { href: "/supplies", label: "Stock overview", feature: "supplies" },
      { href: "/supplies/requests", label: "Supply requests",
        roles: ["super_admin", "admin", "center_manager", "teacher", "backup_teacher",
                "sports_teacher", "misc_teacher", "store_manager"] },
      { href: "/supplies/distribute", label: "Distribute to students",
        roles: ["super_admin", "admin"] },
    ],
  },

  {
    label: "Insights", children: [
      { href: "/statistics", label: "Statistics", feature: "statistics" },
      { href: "/statistics/trends", label: "Trends", feature: "statistics" },
      { href: "/reports", label: "Reports", feature: "reports" },
      { href: "/data", label: "Data explorer", roles: ["super_admin"] },
    ],
  },

  {
    label: "Administration", children: [
      {
        label: "People", children: [
          { href: "/manage/staff", label: "Staff", feature: "staff" },
          { href: "/manage/allocations", label: "Class allocation",
            roles: ["super_admin", "admin", "center_manager"] },
          { href: "/manage/coverage", label: "Backup cover", feature: "coverage" },
        ],
      },
      {
        label: "Setup", children: [
          { href: "/manage/centers", label: "Centres", feature: "centres" },
          { href: "/manage/classes", label: "Classes", roles: ["super_admin", "admin"] },
          { href: "/manage/sessions", label: "Sessions", roles: ["super_admin", "admin"] },
          { href: "/manage/working-days", label: "Working days", roles: ["super_admin", "admin"] },
          { href: "/manage/holidays", label: "Holidays",
            roles: ["super_admin", "admin", "mentor"] },
          { href: "/manage/syllabus", label: "Syllabus", roles: ["super_admin", "admin"] },
          { href: "/manage/manual", label: "Training manuals", roles: ["super_admin", "admin"] },
          { href: "/manage/menu-access", label: "Menu access", roles: ["super_admin"] },
        ],
      },
    ],
  },

  {
    label: "Staff training", children: [
      { href: "/manage/tests/dashboard", label: "Training dashboard",
        roles: ["super_admin", "admin"] },
      { href: "/my-test", label: "My test",
        roles: ["teacher", "backup_teacher", "mentor", "sports_teacher",
                "misc_teacher", "center_manager"] },
      { href: "/manage/tests", label: "Question bank", roles: ["super_admin", "admin"] },
      { href: "/manage/tests/results", label: "Test results", roles: ["super_admin", "admin"] },
    ],
  },

  { href: "/manual", label: "Training Manual" },
];

/** All leaf hrefs the given role can reach (ignoring any saved overrides). */
export function accessibleHrefs(role: Role): string[] {
  const out: string[] = [];
  function walk(nodes: TreeNode[]) {
    for (const n of nodes) {
      if (!allowed(n, role)) continue;
      if (isGroup(n)) walk(n.children);
      else out.push(n.href);
    }
  }
  walk(TREE);
  return out;
}

/** Flat list of {href, label, group} for every item in the menu tree. */
export function flatMenuItems(): { href: string; label: string; group: string }[] {
  const out: { href: string; label: string; group: string }[] = [];
  function walk(nodes: TreeNode[], groupLabel: string) {
    for (const n of nodes) {
      if (isGroup(n)) {
        const child = groupLabel ? `${groupLabel} › ${n.label}` : n.label;
        walk(n.children, child);
      } else {
        out.push({ href: n.href, label: n.label, group: groupLabel || "Top level" });
      }
    }
  }
  walk(TREE, "");
  return out;
}
