export type Role = "super_admin" | "center_manager" | "teacher";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  center_manager: "Centre Manager",
  teacher: "Teacher",
};
