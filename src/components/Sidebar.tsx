"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  IconGrid, IconUsers, IconChat, IconCal, IconChart,
  IconBuilding, IconLayers, IconCheck, IconBook, IconBox, IconChevron,
} from "./icons";
import { can, canAdmitStudents, type Feature, type Role } from "@/lib/roles";

type Icon = (p: { className?: string }) => ReactNode;

type Gate = {
  /** Only these roles see it; omitted means every role that clears `feature`. */
  roles?: Role[];
  feature?: Feature;
  /** For the handful of cases a named gate answers better than a role list. */
  when?: (role: Role) => boolean;
};

type Leaf = Gate & { href: string; label: string; icon?: Icon };
type Group = Gate & { label: string; icon: Icon; children: Node[] };
type Node = Leaf | Group;

const isGroup = (n: Node): n is Group => "children" in n;

/**
 * The menu, as a tree. Grouping is by what somebody is trying to do, not by
 * which table the page reads — "mark the register" and "see who checked in"
 * belong together even though one is a student and one is staff.
 *
 * Depth is only worth paying for where it buys something: Administration holds
 * nine items and earns a third level, everything else stops at two.
 */
const MENU: Node[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },

  {
    label: "Students", icon: IconUsers, children: [
      { href: "/students", label: "All students", feature: "students" },
      { href: "/students/new", label: "New admission", when: canAdmitStudents },
      { href: "/progress-reports", label: "Progress reports", feature: "progressReports" },
      { href: "/manage/promotions", label: "Promotions", roles: ["super_admin"] },
    ],
  },

  {
    label: "Attendance", icon: IconCheck, children: [
      { href: "/attendance", label: "Student register", feature: "attendance" },
      { href: "/my-attendance", label: "My check-in", feature: "ownCheckIn" },
      { href: "/manage/staff-attendance", label: "Staff attendance",
        roles: ["super_admin", "admin", "center_manager"] },
    ],
  },

  {
    label: "Teaching", icon: IconBook, children: [
      { href: "/timetable", label: "Timetable", feature: "timetable" },
      { href: "/teaching-plans", label: "Teaching plans", feature: "teachingPlans" },
      { href: "/exams", label: "Tests & marks", feature: "exams" },
      { href: "/teacher-remarks", label: "Teacher remarks", feature: "teacherRemarks" },
    ],
  },

  {
    label: "Parents & support", icon: IconChat, children: [
      { href: "/ptm", label: "PTM interactions", feature: "ptm" },
      { href: "/follow-ups", label: "Follow-ups", feature: "followUps" },
      { href: "/counselling", label: "Counselling", feature: "counselling" },
    ],
  },

  { href: "/calendar", label: "Calendar", icon: IconCal, feature: "calendar" },
  // everyone gets one, and everyone gets a different one
  { href: "/manual", label: "Training Manual", icon: IconBook },
  { href: "/supplies", label: "Supplies", icon: IconBox, feature: "supplies" },

  {
    label: "Insights", icon: IconChart, children: [
      { href: "/statistics", label: "Statistics", feature: "statistics" },
      { href: "/reports", label: "Reports", feature: "reports" },
    ],
  },

  {
    label: "Administration", icon: IconBuilding, children: [
      {
        label: "People", icon: IconUsers, children: [
          { href: "/manage/staff", label: "Staff", feature: "staff" },
          { href: "/manage/allocations", label: "Class allocation",
            roles: ["super_admin", "admin", "center_manager"] },
          { href: "/manage/coverage", label: "Backup cover", feature: "coverage" },
        ],
      },
      {
        label: "Setup", icon: IconLayers, children: [
          { href: "/manage/centers", label: "Centres", feature: "centres" },
          { href: "/manage/classes", label: "Classes", roles: ["super_admin"] },
          { href: "/manage/sessions", label: "Sessions", roles: ["super_admin"] },
          { href: "/manage/working-days", label: "Working days", roles: ["super_admin"] },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ helpers */

function allowed(n: Node, role: Role): boolean {
  if (n.roles && !n.roles.includes(role)) return false;
  if (n.feature && !can(role, n.feature)) return false;
  if (n.when && !n.when(role)) return false;
  return true;
}

/** A group is only worth showing if something inside it is. */
function visible(n: Node, role: Role): boolean {
  if (!allowed(n, role)) return false;
  return isGroup(n) ? n.children.some((c) => visible(c, role)) : true;
}

function leaves(n: Node): Leaf[] {
  return isGroup(n) ? n.children.flatMap(leaves) : [n];
}

/**
 * Which link the current path belongs to. The longest matching href wins, so
 * /students/new lights up "New admission" rather than "All students".
 */
function activeHref(path: string, role: Role): string | null {
  const all = MENU.filter((n) => visible(n, role)).flatMap(leaves)
    .filter((l) => visible(l, role));
  let best: string | null = null;
  for (const l of all) {
    if (path === l.href || path.startsWith(l.href + "/")) {
      if (!best || l.href.length > best.length) best = l.href;
    }
  }
  return best;
}

function contains(n: Node, href: string): boolean {
  return isGroup(n) ? n.children.some((c) => contains(c, href)) : n.href === href;
}

/* -------------------------------------------------------------- the vertical */

function Row({ node, role, active, depth }: {
  node: Node; role: Role; active: string | null; depth: number;
}) {
  const holdsActive = active !== null && contains(node, active);
  const [open, setOpen] = useState(holdsActive);
  // A group opens itself when the page moves inside it, and otherwise stays
  // wherever the reader left it. Adjusting state during render is React's own
  // answer to "a prop changed and this state derives from it".
  const [wasActive, setWasActive] = useState(holdsActive);
  if (holdsActive !== wasActive) {
    setWasActive(holdsActive);
    setOpen(holdsActive);
  }
  const expanded = open;

  if (!isGroup(node)) {
    const Icon = node.icon;
    return (
      <Link href={node.href} className="nav-item" data-active={active === node.href}
        style={depth ? { paddingLeft: `${0.75 + depth * 0.9}rem` } : undefined}>
        {Icon ? <Icon className="h-[18px] w-[18px] flex-none" /> : <span className="nav-dot" />}
        <span className="truncate">{node.label}</span>
      </Link>
    );
  }

  const Icon = node.icon;
  return (
    <div>
      <button type="button" className="nav-item w-full" data-open={expanded}
        aria-expanded={expanded}
        style={depth ? { paddingLeft: `${0.75 + depth * 0.9}rem` } : undefined}
        onClick={() => setOpen(!expanded)}>
        <Icon className="h-[18px] w-[18px] flex-none" />
        <span className="flex-1 truncate text-left">{node.label}</span>
        <IconChevron className={`h-[14px] w-[14px] flex-none transition-transform ${
          expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-[var(--border)] pl-1"
          style={{ marginLeft: "0.9rem" }}>
          {node.children.filter((c) => visible(c, role)).map((c) => (
            <Row key={isGroup(c) ? c.label : c.href} node={c} role={role}
              active={active} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ the horizontal */

/**
 * On a phone the tree becomes two rows: the sections, then the pages inside
 * whichever section you are in. Tapping a section switches the second row.
 */
function Horizontal({ role, active }: { role: Role; active: string | null }) {
  const top = MENU.filter((n) => visible(n, role));
  const current = top.find((n) => active !== null && contains(n, active));
  const [picked, setPicked] = useState<string | null>(null);
  const shownLabel = picked ?? (current && isGroup(current) ? current.label : null);
  const shown = top.find((n) => isGroup(n) && n.label === shownLabel) as Group | undefined;

  return (
    <div className="px-3 py-2">
      <nav className="flex gap-1">
        {top.map((n) => {
          if (!isGroup(n)) {
            const LeafIcon = n.icon;
            return (
              <Link key={n.href} href={n.href} className="nav-item whitespace-nowrap"
                data-active={active === n.href} onClick={() => setPicked(null)}>
                {LeafIcon && <LeafIcon className="h-[18px] w-[18px] flex-none" />}
                <span>{n.label}</span>
              </Link>
            );
          }
          const GroupIcon = n.icon;
          const on = n.label === shownLabel;
          return (
            <button key={n.label} type="button"
              className="nav-item whitespace-nowrap" data-open={on}
              aria-expanded={on}
              onClick={() => setPicked(on ? null : n.label)}>
              <GroupIcon className="h-[18px] w-[18px] flex-none" />
              <span>{n.label}</span>
              <IconChevron className={`h-[13px] w-[13px] flex-none transition-transform ${
                on ? "rotate-90" : ""}`} />
            </button>
          );
        })}
      </nav>

      {shown && (
        <nav className="mt-1 flex gap-1 border-t border-[var(--border)] pt-1.5">
          {shown.children.filter((c) => visible(c, role)).flatMap(leaves)
            .filter((l) => visible(l, role))
            .map((l) => (
              <Link key={l.href} href={l.href} className="nav-item nav-item-sm whitespace-nowrap"
                data-active={active === l.href}>
                {l.label}
              </Link>
            ))}
        </nav>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- export */

export default function Sidebar({ role, horizontal = false }:
  { role: Role; horizontal?: boolean }) {
  const path = usePathname();
  const active = activeHref(path, role);

  if (horizontal) return <Horizontal role={role} active={active} />;

  return (
    <nav className="flex flex-col gap-0.5 px-3 pb-6">
      {MENU.filter((n) => visible(n, role)).map((n) => (
        <Row key={isGroup(n) ? n.label : n.href} node={n} role={role}
          active={active} depth={0} />
      ))}
    </nav>
  );
}
