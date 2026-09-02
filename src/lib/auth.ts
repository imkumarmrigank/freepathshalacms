import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { one, query } from "./db";

export const COOKIE = "fp_session";
export type { Role } from "./roles";
import { can, isGlobalRole, type Feature, type Role } from "./roles";

export type SessionUser = {
  uid: number;
  name: string;
  email: string;
  role: Role;
  centerId: number | null;
  centerName: string | null;
  /** Centres a backup teacher is currently standing in at. Empty otherwise. */
  centerIds: number[];
  /** Teachers this person is currently covering, whose classes they inherit. */
  coveringIds: number[];
};

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      uid: Number(payload.uid),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      centerId: payload.centerId == null ? null : Number(payload.centerId),
      centerName: payload.centerName == null ? null : String(payload.centerName),
      centerIds: Array.isArray(payload.centerIds) ? payload.centerIds.map(Number) : [],
      coveringIds: Array.isArray(payload.coveringIds) ? payload.coveringIds.map(Number) : [],
    };
  } catch {
    return null;
  }
}

/** Use in every protected page / action. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSession();
  if (!u) redirect("/login");
  return u;
}

/** Redirects unless this role holds the feature. The sidebar hides it; this refuses it. */
export async function requireFeature(feature: Feature): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u.role, feature)) redirect("/dashboard?denied=1");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/dashboard?denied=1");
  return u;
}

export const isAdmin = (u: SessionUser) => u.role === "super_admin";
/** Works across every centre rather than being pinned to one. */
export const isGlobal = (u: SessionUser) => isGlobalRole(u.role);
export const canManageCenter = (u: SessionUser) =>
  isGlobalRole(u.role) || u.role === "center_manager";

/** Every centre this user may act on, or null when unrestricted. */
export function allowedCenterIds(u: SessionUser): number[] | null {
  if (isGlobalRole(u.role)) return null;              // super admin, admin, mentor
  if (u.role === "backup_teacher") return u.centerIds; // wherever they are covering
  return u.centerId == null ? [] : [u.centerId];
}

/**
 * Whose class allocations this person acts under. A backup teacher inherits the
 * classes of every teacher they are currently standing in for.
 */
export function effectiveTeacherIds(u: SessionUser): number[] {
  return u.role === "backup_teacher" ? [u.uid, ...u.coveringIds] : [u.uid];
}

/** May this user read or change something belonging to that centre? */
export function canTouchCenter(u: SessionUser, centerId: number | null | undefined) {
  if (centerId == null) return false;
  const allowed = allowedCenterIds(u);
  return allowed === null || allowed.includes(centerId);
}

/**
 * Centre scoping: super admins see everything (or a chosen centre); a mentor
 * works within the centres allotted to them; managers and teachers are pinned
 * to their own.
 */
export function scopedCenterId(u: SessionUser, requested?: number | null): number | null {
  if (isGlobalRole(u.role)) return requested ?? null;
  if (u.role === "backup_teacher") {
    if (requested != null && u.centerIds.includes(requested)) return requested;
    // never fall through to "no filter" — that would expose every centre
    return u.centerIds[0] ?? -1;
  }
  return u.centerId;
}

export async function verifyLogin(email: string, password: string) {
  const row = await one<{
    id: number; name: string; email: string; password_hash: string;
    role: Role; center_id: number | null; center_name: string | null; is_active: boolean;
  }>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.center_id, u.is_active,
            c.name AS center_name
       FROM users u LEFT JOIN centers c ON c.id = u.center_id
      WHERE lower(u.email) = lower($1)`,
    [email.trim()],
  );
  if (!row || !row.is_active) return null;
  if (!(await bcrypt.compare(password, row.password_hash))) return null;
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
  // A backup teacher's reach comes from the stand-ins they are currently on.
  const coverage = row.role === "backup_teacher"
    ? await query<{ center_id: number; covering_id: number }>(
        `SELECT center_id, covering_id FROM teacher_coverage
          WHERE backup_id = $1 AND starts_on <= CURRENT_DATE
            AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)`,
        [row.id])
    : [];

  return {
    uid: row.id, name: row.name, email: row.email, role: row.role,
    centerId: row.center_id, centerName: row.center_name,
    centerIds: [...new Set(coverage.map((c) => c.center_id))],
    coveringIds: [...new Set(coverage.map((c) => c.covering_id))],
  } satisfies SessionUser;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
