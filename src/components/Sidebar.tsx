"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconGrid, IconUsers, IconChat, IconCal, IconChart, IconPin,
  IconBuilding, IconLayers, IconArrowUp, IconCheck, IconClock, IconBook, IconBox, IconAward, IconReport,
} from "./icons";
import type { Role } from "@/lib/roles";

type Item = { href: string; label: string; icon: (p: { className?: string }) => ReactNode; roles?: Role[] };

const MAIN: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/students", label: "Students", icon: IconUsers },
  { href: "/attendance", label: "Student Attendance", icon: IconCheck },
  { href: "/my-attendance", label: "My Attendance", icon: IconPin, roles: ["center_manager", "teacher"] },
  { href: "/timetable", label: "Timetable", icon: IconClock },
  { href: "/teaching-plans", label: "Teaching Plans", icon: IconBook },
  { href: "/exams", label: "Tests & Marks", icon: IconAward },
  { href: "/progress-reports", label: "Progress Reports", icon: IconReport },
  { href: "/calendar", label: "Calendar", icon: IconCal },
  { href: "/ptm", label: "PTM Interactions", icon: IconChat },
  { href: "/follow-ups", label: "Follow-ups", icon: IconClock },
  { href: "/supplies", label: "Supplies", icon: IconBox, roles: ["super_admin", "mentor", "center_manager"] },
  { href: "/reports", label: "Reports", icon: IconChart },
];

const ADMIN: Item[] = [
  { href: "/manage/centers", label: "Centres", icon: IconBuilding, roles: ["super_admin", "mentor"] },
  { href: "/manage/staff", label: "Staff", icon: IconUsers, roles: ["super_admin", "center_manager"] },
  { href: "/manage/allocations", label: "Class Allocation", icon: IconLayers, roles: ["super_admin", "center_manager"] },
  { href: "/manage/staff-attendance", label: "Staff Attendance", icon: IconPin, roles: ["super_admin", "mentor", "center_manager"] },
  { href: "/manage/sessions", label: "Sessions", icon: IconLayers, roles: ["super_admin"] },
  { href: "/manage/classes", label: "Classes", icon: IconLayers, roles: ["super_admin"] },
  { href: "/manage/promotions", label: "Promotions", icon: IconArrowUp, roles: ["super_admin"] },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="nav-item" data-active={active}>
      <Icon className="h-[18px] w-[18px] flex-none" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar({ role, horizontal = false }: { role: Role; horizontal?: boolean }) {
  const path = usePathname();
  const visible = (i: Item) => !i.roles || i.roles.includes(role);
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const admin = ADMIN.filter(visible);

  if (horizontal) {
    return (
      <nav className="flex gap-1 px-3 py-2">
        {[...MAIN, ...ADMIN].filter(visible).map((i) => (
          <NavLink key={i.href} item={i} active={isActive(i.href)} />
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 px-3 pb-6">
      {MAIN.filter(visible).map((i) => (
        <NavLink key={i.href} item={i} active={isActive(i.href)} />
      ))}
      {admin.length > 0 && (
        <>
          <div className="nav-section">Administration</div>
          {admin.map((i) => <NavLink key={i.href} item={i} active={isActive(i.href)} />)}
        </>
      )}
    </nav>
  );
}
