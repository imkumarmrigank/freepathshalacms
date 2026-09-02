import "server-only";
import { one, query } from "./db";
import type { SessionUser } from "./auth";
import { isGlobalRole } from "./roles";

export type Center = {
  id: number; code: string; name: string; area: string | null; city: string | null;
  address: string | null; phone: string | null;
  latitude: number | null; longitude: number | null; geofence_radius_m: number;
  manager_id: number | null; manager_name?: string | null; is_active: boolean;
};

export type AcademicSession = {
  id: number; name: string; start_date: string; end_date: string;
  sequence: number; is_current: boolean; is_locked: boolean;
};

export type ClassLevel = {
  id: number; name: string; sequence: number; is_terminal: boolean; is_active: boolean;
};

export async function currentSession() {
  return one<AcademicSession>(
    "SELECT * FROM academic_sessions WHERE is_current ORDER BY sequence DESC LIMIT 1",
  );
}

export async function listSessions() {
  return query<AcademicSession>("SELECT * FROM academic_sessions ORDER BY sequence DESC");
}

export async function listClasses(activeOnly = true) {
  return query<ClassLevel>(
    `SELECT * FROM class_levels ${activeOnly ? "WHERE is_active" : ""} ORDER BY sequence`,
  );
}

export async function listCenters(activeOnly = true) {
  return query<Center>(
    `SELECT c.*, u.name AS manager_name
       FROM centers c LEFT JOIN users u ON u.id = c.manager_id
      ${activeOnly ? "WHERE c.is_active" : ""}
      ORDER BY c.code`,
  );
}

/** Centres this user is allowed to look at. */
export async function centersForUser(u: SessionUser) {
  if (isGlobalRole(u.role)) return listCenters();
  if (!u.centerId) return [];
  return query<Center>(
    `SELECT c.*, m.name AS manager_name FROM centers c
       LEFT JOIN users m ON m.id = c.manager_id WHERE c.id = $1`,
    [u.centerId],
  );
}

export async function getCenter(id: number) {
  return one<Center>(
    `SELECT c.*, u.name AS manager_name FROM centers c
       LEFT JOIN users u ON u.id = c.manager_id WHERE c.id = $1`,
    [id],
  );
}

/**
 * Resolves the centre a request should operate on.
 * Non-admins are always pinned to their own centre regardless of the query string.
 */
export function resolveCenterId(u: SessionUser, requested?: string | number | null) {
  if (!isGlobalRole(u.role)) return u.centerId;
  const n = Number(requested);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Adds `AND center_id = $n` only when a centre filter applies. */
export function centerFilter(centerId: number | null, params: unknown[], col = "center_id") {
  if (centerId == null) return "";
  params.push(centerId);
  return ` AND ${col} = $${params.length}`;
}
