"use server";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser, hashPassword, canTouchCenter } from "@/lib/auth";
import { canCreateCentre, canCreateRole, canManageStaff, isGlobalRole, type Role, isTeaching } from "@/lib/roles";
import { one, query } from "@/lib/db";
import { GEOFENCE_DEFAULT_M, GEOFENCE_MAX_M, GEOFENCE_MIN_M } from "@/lib/geo";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const numOrNull = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === null ? null : Number(v);
};

/* ------------------------------------------------------------------ centres */
export async function saveCenter(_prev: unknown, form: FormData) {
  const actor = await requireRole("super_admin", "mentor");
  const id = numOrNull(form, "id");
  // a mentor maintains the centres that exist; opening a new one is the admin's call
  if (!id && !canCreateCentre(actor.role))
    return { error: "Only the administrator can open a new centre." };
  const code = str(form, "code")?.toUpperCase();
  const name = str(form, "name");
  if (!code || !name) return { error: "Centre code and name are required." };

  const lat = numOrNull(form, "latitude");
  const lng = numOrNull(form, "longitude");
  if ((lat === null) !== (lng === null))
    return { error: "Give both latitude and longitude, or neither." };
  if (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng!) > 180))
    return { error: "Those coordinates are out of range." };

  const radius = numOrNull(form, "geofence_radius_m") ?? GEOFENCE_DEFAULT_M;
  if (radius < GEOFENCE_MIN_M || radius > GEOFENCE_MAX_M)
    return {
      error: `The check-in radius must be between ${GEOFENCE_MIN_M} m and ${GEOFENCE_MAX_M} m — ` +
             "small enough to prove someone is at the centre, wide enough for a phone's own GPS error.",
    };

  try {
    if (id) {
      await query(
        `UPDATE centers SET code=$2, name=$3, area=$4, address=$5, city=$6, state=$7,
            pincode=$8, phone=$9, latitude=$10, longitude=$11, geofence_radius_m=$12,
            is_active=$13 WHERE id=$1`,
        [id, code, name, str(form, "area"), str(form, "address"), str(form, "city"),
         str(form, "state"), str(form, "pincode"), str(form, "phone"), lat, lng, radius,
         form.get("is_active") === "on"],
      );
    } else {
      await query(
        `INSERT INTO centers (code, name, area, address, city, state, pincode, phone,
            latitude, longitude, geofence_radius_m)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [code, name, str(form, "area"), str(form, "address"), str(form, "city"),
         str(form, "state"), str(form, "pincode"), str(form, "phone"), lat, lng, radius],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the centre.";
    return { error: msg.includes("centers_code_key") ? `Centre code ${code} is already in use.` : msg };
  }
  revalidatePath("/manage/centers");
  return { ok: id ? "Centre updated." : `Centre ${code} created.` };
}

export async function assignManager(_prev: unknown, form: FormData) {
  await requireRole("super_admin", "mentor");
  const centerId = Number(form.get("center_id"));
  const userId = numOrNull(form, "manager_id");
  if (userId) {
    const u = await one<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
    if (!u) return { error: "User not found." };
    await query("UPDATE users SET role = 'center_manager', center_id = $2 WHERE id = $1",
      [userId, centerId]);
  }
  await query("UPDATE centers SET manager_id = $2 WHERE id = $1", [centerId, userId]);
  revalidatePath("/manage/centers");
  return { ok: userId ? "Manager assigned." : "Manager removed." };
}

/* -------------------------------------------------------------------- staff */
export async function saveStaff(_prev: unknown, form: FormData) {
  const actor = await requireUser();
  if (!canManageStaff(actor.role)) return { error: "You cannot manage staff." };

  const id = numOrNull(form, "id");
  const name = str(form, "name");
  const email = str(form, "email")?.toLowerCase();
  const role = String(form.get("role") ?? "teacher") as Role;
  if (!name || !email) return { error: "Name and email are required." };

  if (!canCreateRole(actor.role, role))
    return { error: `You cannot ${id ? "assign" : "create"} the ${role.replace(/_/g, " ")} role.` };

  // A centre manager works only inside their own centre; the rest may pick one.
  let centerId = isGlobalRole(actor.role) ? numOrNull(form, "center_id") : actor.centerId;
  if (!isGlobalRole(role) && !centerId) return { error: "Pick a centre for this person." };
  if (centerId && !canTouchCenter(actor, centerId))
    return { error: "That centre is not one of yours." };
  if (isGlobalRole(role)) centerId = null;

  const password = str(form, "password");
  if (!id && !password) return { error: "Set an initial password." };
  if (password && password.length < 8) return { error: "Password must be at least 8 characters." };

  try {
    if (id) {
      const target = await one<{ center_id: number | null; role: Role }>(
        "SELECT center_id, role FROM users WHERE id = $1", [id]);
      if (!target) return { error: "User not found." };
      if (!canCreateRole(actor.role, target.role))
        return { error: `You cannot edit a ${target.role.replace(/_/g, " ")} account.` };
      if (!canTouchCenter(actor, target.center_id))
        return { error: "That person is not at your centre." };

      await query(
        `UPDATE users SET name=$2, email=$3, phone=$4, role=$5, center_id=$6,
            designation=$7, is_active=$8 ${password ? ", password_hash=$9" : ""}
          WHERE id=$1`,
        password
          ? [id, name, email, str(form, "phone"), role, centerId, str(form, "designation"),
             form.get("is_active") === "on", await hashPassword(password)]
          : [id, name, email, str(form, "phone"), role, centerId, str(form, "designation"),
             form.get("is_active") === "on"],
      );
    } else {
      await query(
        `INSERT INTO users (name, email, phone, password_hash, role, center_id, designation)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [name, email, str(form, "phone"), await hashPassword(password!), role, centerId,
         str(form, "designation")],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save.";
    return { error: msg.includes("users_email_key") ? `${email} is already registered.` : msg };
  }
  revalidatePath("/manage/staff");
  return { ok: id ? "Staff member updated." : "Staff member added." };
}

/* ----------------------------------------------------------------- sessions */
export async function saveSession(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const id = numOrNull(form, "id");
  const name = str(form, "name");
  const start = str(form, "start_date");
  const end = str(form, "end_date");
  if (!name || !start || !end) return { error: "Name, start and end dates are required." };
  if (end <= start) return { error: "The end date must be after the start date." };

  try {
    if (id) {
      await query(
        "UPDATE academic_sessions SET name=$2, start_date=$3, end_date=$4, sequence=$5 WHERE id=$1",
        [id, name, start, end, numOrNull(form, "sequence") ?? 1],
      );
    } else {
      const seq = numOrNull(form, "sequence")
        ?? Number((await one<{ n: string }>("SELECT COALESCE(max(sequence),0)+1 AS n FROM academic_sessions"))!.n);
      await query(
        "INSERT INTO academic_sessions (name, start_date, end_date, sequence) VALUES ($1,$2,$3,$4)",
        [name, start, end, seq],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the session.";
    return { error: msg.includes("academic_sessions_name_key") ? `Session ${name} already exists.` : msg };
  }
  revalidatePath("/manage/sessions");
  return { ok: id ? "Session updated." : "Session created." };
}

export async function setCurrentSession(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const id = Number(form.get("id"));
  await query("UPDATE academic_sessions SET is_current = FALSE WHERE is_current");
  await query("UPDATE academic_sessions SET is_current = TRUE, is_locked = FALSE WHERE id = $1", [id]);
  revalidatePath("/manage/sessions");
  revalidatePath("/dashboard");
  return { ok: "Current session changed." };
}

/* ------------------------------------------------------------------ classes */
export async function saveClass(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const id = numOrNull(form, "id");
  const name = str(form, "name");
  const sequence = numOrNull(form, "sequence");
  if (!name || !sequence) return { error: "Class name and order are required." };

  try {
    if (id) {
      await query(
        "UPDATE class_levels SET name=$2, sequence=$3, is_terminal=$4, is_active=$5 WHERE id=$1",
        [id, name, sequence, form.get("is_terminal") === "on", form.get("is_active") === "on"],
      );
    } else {
      await query(
        "INSERT INTO class_levels (name, sequence, is_terminal) VALUES ($1,$2,$3)",
        [name, sequence, form.get("is_terminal") === "on"],
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not save the class.";
    return { error: msg.includes("class_levels_sequence_key")
      ? `Order ${sequence} is already used by another class.`
      : msg.includes("class_levels_name_key") ? `${name} already exists.` : msg };
  }
  revalidatePath("/manage/classes");
  return { ok: id ? "Class updated." : "Class added." };
}

/* ------------------------------------------- manager override on staff punch */
export async function overrideStaffAttendance(_prev: unknown, form: FormData) {
  const actor = await requireUser();
  if (isTeaching(actor.role)) return { error: "You cannot change staff attendance." };
  const userId = Number(form.get("user_id"));
  const attDate = String(form.get("att_date"));
  const status = String(form.get("status"));
  const reason = str(form, "override_reason");

  const target = await one<{ center_id: number | null }>(
    "SELECT center_id FROM users WHERE id = $1", [userId]);
  if (!target) return { error: "User not found." };
  if (actor.role !== "super_admin" && target.center_id !== actor.centerId)
    return { error: "That person is not at your centre." };
  if (!reason) return { error: "Give a reason for the manual entry." };

  await query(
    `INSERT INTO staff_attendance (user_id, center_id, att_date, status, within_geofence,
        override_by, override_reason)
     VALUES ($1,$2,$3,$4, FALSE, $5, $6)
     ON CONFLICT (user_id, att_date) DO UPDATE
       SET status = EXCLUDED.status, override_by = EXCLUDED.override_by,
           override_reason = EXCLUDED.override_reason`,
    [userId, target.center_id, attDate, status, actor.uid, reason],
  );
  revalidatePath("/manage/staff-attendance");
  return { ok: "Staff attendance updated." };
}
