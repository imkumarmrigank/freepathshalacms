export type Role = "super_admin" | "mentor" | "center_manager" | "teacher";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  mentor: "Mentor",
  center_manager: "Centre Manager",
  teacher: "Teacher",
};

/**
 * Roles that work across every centre instead of being pinned to one.
 * Everything that scopes data by centre asks this rather than naming a role.
 */
export const GLOBAL_ROLES: Role[] = ["super_admin", "mentor"];

export function isGlobalRole(role: Role) {
  return role === "super_admin" || role === "mentor";
}

/** Structural settings that stay with the super admin alone. */
export function canAdminister(role: Role) {
  return role === "super_admin";
}

/**
 * Which roles each actor may create.
 *   super admin     -> anyone, including mentors
 *   mentor          -> centre managers and teachers, at any centre
 *   centre manager  -> teachers, at their own centre
 *   teacher         -> nobody
 */
export const CREATABLE_ROLES: Record<Role, Role[]> = {
  super_admin: ["super_admin", "mentor", "center_manager", "teacher"],
  mentor: ["center_manager", "teacher"],
  center_manager: ["teacher"],
  teacher: [],
};

export function canCreateRole(actor: Role, target: Role) {
  return CREATABLE_ROLES[actor].includes(target);
}

export function canManageStaff(role: Role) {
  return CREATABLE_ROLES[role].length > 0;
}

/** Only the super admin opens a new centre; a mentor maintains existing ones. */
export function canCreateCentre(role: Role) {
  return role === "super_admin";
}

/** Centres, and the supply chain from HQ to centre to student. */
export function canManageSupplies(role: Role) {
  return role === "super_admin" || role === "mentor" || role === "center_manager";
}

/** Only HQ-level roles record goods in and dispatch them to a centre. */
export function canManageHqStock(role: Role) {
  return role === "super_admin" || role === "mentor";
}
