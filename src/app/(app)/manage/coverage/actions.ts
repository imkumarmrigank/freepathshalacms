"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { currentSession } from "@/lib/queries";
import { canAssignCoverage } from "@/lib/roles";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Stand a backup teacher in for an absent teacher at a centre. */
export async function assignCoverage(_prev: unknown, form: FormData) {
  const actor = await requireUser();
  if (!canAssignCoverage(actor.role))
    return { error: "Only an admin can assign a backup teacher." };

  const backupId = Number(form.get("backup_id"));
  const coveringId = Number(form.get("covering_id"));
  const startsOn = str(form, "starts_on") ?? new Date().toISOString().slice(0, 10);
  const endsOn = str(form, "ends_on");

  if (!backupId || !coveringId) return { error: "Choose a backup teacher and who they cover." };
  if (backupId === coveringId) return { error: "Somebody cannot cover themselves." };
  if (endsOn && endsOn < startsOn) return { error: "The end date cannot be before the start." };

  const backup = await one<{ role: string; name: string }>(
    "SELECT role, name FROM users WHERE id = $1 AND is_active", [backupId]);
  if (!backup) return { error: "Backup teacher not found." };
  if (backup.role !== "backup_teacher")
    return { error: `${backup.name} is not a backup teacher.` };

  const absent = await one<{ role: string; center_id: number | null; name: string }>(
    "SELECT role, center_id, name FROM users WHERE id = $1 AND is_active", [coveringId]);
  if (!absent) return { error: "That teacher could not be found." };
  if (absent.role !== "teacher")
    return { error: `${absent.name} is not a regular teacher.` };
  if (!absent.center_id) return { error: `${absent.name} is not attached to a centre.` };

  // one open-ended stand-in per pair is enough; overlapping rows only confuse the roster
  const clash = await one<{ id: number }>(
    `SELECT id FROM teacher_coverage
      WHERE backup_id = $1 AND covering_id = $2
        AND (ends_on IS NULL OR ends_on >= $3)
        AND ($4::date IS NULL OR starts_on <= $4)`,
    [backupId, coveringId, startsOn, endsOn],
  );
  if (clash) return { error: "That cover already exists for these dates." };

  const session = await currentSession();
  await query(
    `INSERT INTO teacher_coverage
       (backup_id, covering_id, center_id, session_id, starts_on, ends_on, reason, assigned_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [backupId, coveringId, absent.center_id, session?.id ?? null,
     startsOn, endsOn, str(form, "reason"), actor.uid],
  );

  revalidatePath("/manage/coverage");
  return { ok: `${backup.name} is now covering ${absent.name}.` };
}

/** End a stand-in today rather than deleting the record of it. */
export async function endCoverage(_prev: unknown, form: FormData) {
  const actor = await requireUser();
  if (!canAssignCoverage(actor.role))
    return { error: "Only an admin can end a cover." };
  const id = Number(form.get("id"));
  await query(
    `UPDATE teacher_coverage
        SET ends_on = LEAST(COALESCE(ends_on, CURRENT_DATE), CURRENT_DATE)
      WHERE id = $1`,
    [id],
  );
  revalidatePath("/manage/coverage");
  return { ok: "Cover ended." };
}
