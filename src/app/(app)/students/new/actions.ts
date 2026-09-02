"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { canTouchCenter, requireUser } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { nextEnrollmentNo } from "@/lib/enrollment";
import { currentSession } from "@/lib/queries";
import { isAadhaar, isEmail, isMobile } from "@/lib/admission-meta";

/** The wizard's own shape. Kept loose so a half-filled draft is always storable. */
export type AdmissionPayload = Record<string, unknown>;

const s = (p: AdmissionPayload, k: string) => {
  const v = p[k];
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};
const n = (p: AdmissionPayload, k: string) => {
  const v = s(p, k);
  return v === null ? null : Number(v);
};
const b = (p: AdmissionPayload, k: string) => p[k] === true || p[k] === "true";
const mediaId = (p: AdmissionPayload, k: string) => {
  const v = n(p, k);
  return v && Number.isFinite(v) ? v : null;
};

/** A running number per scope, allocated inside the caller's transaction. */
async function nextNumber(client: PoolClient, scope: string, prefix: string) {
  await client.query(
    `INSERT INTO number_counters (scope, next_seq) VALUES ($1, 1)
     ON CONFLICT (scope) DO NOTHING`, [scope]);
  const { rows } = await client.query<{ next_seq: number }>(
    "SELECT next_seq FROM number_counters WHERE scope = $1 FOR UPDATE", [scope]);
  const seq = rows[0].next_seq;
  await client.query(
    "UPDATE number_counters SET next_seq = next_seq + 1 WHERE scope = $1", [scope]);
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ drafts */

export async function saveDraft(payload: AdmissionPayload, draftId: number | null) {
  const user = await requireUser();
  if (user.role === "teacher" || user.role === "backup_teacher")
    return { error: "Only the centre manager can admit a student." };

  const name = [s(payload, "first_name"), s(payload, "last_name")]
    .filter(Boolean).join(" ") || null;
  const centerId = n(payload, "center_id");

  if (draftId) {
    const owned = await one<{ id: number }>(
      "SELECT id FROM admission_drafts WHERE id = $1 AND created_by = $2",
      [draftId, user.uid]);
    if (!owned) return { error: "That draft is no longer available." };
    await query(
      `UPDATE admission_drafts
          SET payload = $2, student_name = $3, center_id = $4, updated_at = now()
        WHERE id = $1`,
      [draftId, JSON.stringify(payload), name, centerId]);
    revalidatePath("/students/new");
    return { ok: "Admission saved as draft.", draftId };
  }

  const row = await one<{ id: number }>(
    `INSERT INTO admission_drafts (payload, student_name, center_id, created_by)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [JSON.stringify(payload), name, centerId, user.uid]);
  revalidatePath("/students/new");
  return { ok: "Admission saved as draft.", draftId: row!.id };
}

export async function discardDraft(draftId: number) {
  const user = await requireUser();
  await query("DELETE FROM admission_drafts WHERE id = $1 AND created_by = $2",
    [draftId, user.uid]);
  revalidatePath("/students/new");
  return { ok: "Draft discarded." };
}

/* -------------------------------------------------------------- submission */

export async function submitAdmission(payload: AdmissionPayload, draftId: number | null) {
  const user = await requireUser();
  if (user.role === "teacher" || user.role === "backup_teacher")
    return { error: "Only the centre manager can admit a student." };

  const session = await currentSession();
  if (!session) return { error: "No academic session is open." };

  const firstName = s(payload, "first_name");
  const dob = s(payload, "dob");
  const gender = s(payload, "gender");
  const mobile = s(payload, "primary_phone");
  const address = s(payload, "address");
  const pincode = s(payload, "pincode");
  const city = s(payload, "city");
  const state = s(payload, "state");
  const admissionDate = s(payload, "admission_date");
  const classLevelId = n(payload, "class_level_id");
  const centerId = n(payload, "center_id");

  // the fields the form marks with a star
  if (!firstName) return { error: "Student name is required.", step: 0 };
  if (!dob) return { error: "Date of birth is required.", step: 0 };
  if (!gender) return { error: "Gender is required.", step: 0 };
  if (!mobile) return { error: "Mobile number is required.", step: 1 };
  if (!isMobile(mobile)) return { error: "Please enter a valid mobile number.", step: 1 };
  if (!address) return { error: "Address is required.", step: 1 };
  if (!pincode) return { error: "Pincode is required.", step: 1 };
  if (!city) return { error: "City is required.", step: 1 };
  if (!state) return { error: "State is required.", step: 1 };
  if (!admissionDate) return { error: "Admission date is required.", step: 3 };
  if (!classLevelId) return { error: "Class is required.", step: 3 };
  if (!centerId) return { error: "Centre is required.", step: 3 };
  if (!b(payload, "declaration"))
    return { error: "Please confirm the declaration before submitting.", step: 4 };

  const aadhaar = s(payload, "aadhaar_number");
  if (aadhaar && !isAadhaar(aadhaar))
    return { error: "Please enter a valid Aadhaar number.", step: 3 };
  for (const k of ["email", "mother_email", "father_email", "guardian_email"]) {
    const v = s(payload, k);
    if (v && !isEmail(v)) return { error: "Please enter a valid email address.", step: 2 };
  }

  if (!canTouchCenter(user, centerId))
    return { error: "That centre is not one of yours.", step: 3 };

  const year = admissionDate.slice(0, 4);
  let result: { id: number; enrollmentNo: string; admissionNo: string; registrationNo: string };

  try {
    result = await tx(async (c) => {
      const enrollmentNo = await nextEnrollmentNo(c, centerId);
      const admissionNo = await nextNumber(c, `admission:${year}`, `ADM${year}-`);
      const registrationNo = s(payload, "registration_no")
        ?? await nextNumber(c, `registration:${year}`, `REG${year}-`);

      const { rows } = await c.query<{ id: number }>(
        `INSERT INTO students (
           enrollment_no, admission_no, registration_no, center_id,
           first_name, last_name, gender, dob, place_of_birth, nationality,
           religion, caste, category, blood_group, has_disability, disability_details,
           photo_media_id,
           primary_phone, whatsapp_number, alt_phone, email,
           house_block, address, pincode, city, state, country,
           father_name, father_qualification, father_occupation, father_occupation_other,
           father_income, father_email, father_mobile, father_photo_media_id,
           mother_name, mother_qualification, mother_occupation, mother_occupation_other,
           mother_income, mother_email, mother_mobile, mother_photo_media_id,
           guardian_name, guardian_qualification, guardian_occupation, guardian_occupation_other,
           guardian_income, guardian_email, guardian_mobile, guardian_photo_media_id,
           udise, rte_application_no, apaar_id, aadhaar_number,
           admission_date, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
                 $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
                 $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,
                 $56,$57,$58)
         RETURNING id`,
        [enrollmentNo, admissionNo, registrationNo, centerId,
         firstName, s(payload, "last_name"), gender.toLowerCase(), dob,
         s(payload, "place_of_birth"), s(payload, "nationality"),
         s(payload, "religion"), s(payload, "caste"), s(payload, "category"),
         s(payload, "blood_group"), b(payload, "has_disability"),
         s(payload, "disability_details"), mediaId(payload, "photo_media_id"),
         mobile, s(payload, "whatsapp_number"), s(payload, "alt_phone"), s(payload, "email"),
         s(payload, "house_block"), address, pincode, city, state,
         s(payload, "country") ?? "India",
         s(payload, "father_name"), s(payload, "father_qualification"),
         s(payload, "father_occupation"), s(payload, "father_occupation_other"),
         n(payload, "father_income"),
         s(payload, "father_email"), s(payload, "father_mobile"),
         mediaId(payload, "father_photo_media_id"),
         s(payload, "mother_name"), s(payload, "mother_qualification"),
         s(payload, "mother_occupation"), s(payload, "mother_occupation_other"),
         n(payload, "mother_income"),
         s(payload, "mother_email"), s(payload, "mother_mobile"),
         mediaId(payload, "mother_photo_media_id"),
         s(payload, "guardian_name"), s(payload, "guardian_qualification"),
         s(payload, "guardian_occupation"), s(payload, "guardian_occupation_other"),
         n(payload, "guardian_income"),
         s(payload, "guardian_email"), s(payload, "guardian_mobile"),
         mediaId(payload, "guardian_photo_media_id"),
         payload.udise === null || payload.udise === undefined ? null : b(payload, "udise"),
         s(payload, "rte_application_no"), s(payload, "apaar_id"), aadhaar,
         admissionDate, s(payload, "notes"), user.uid],
      );
      const studentId = rows[0].id;

      // joining after the session opened is a mid-session admission
      const source = admissionDate > String(session.start_date).slice(0, 10)
        ? "mid_session" : "new";
      await c.query(
        `INSERT INTO enrollments (student_id, session_id, class_level_id, center_id,
            section, roll_no, enrolled_on, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [studentId, session.id, classLevelId, centerId,
         s(payload, "section"), n(payload, "roll_no"), admissionDate, source]);

      if (draftId) {
        await c.query("DELETE FROM admission_drafts WHERE id = $1 AND created_by = $2",
          [draftId, user.uid]);
      }
      return { id: studentId, enrollmentNo, admissionNo, registrationNo };
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the admission." };
  }

  revalidatePath("/students");
  redirect(`/students/new/success?student=${result.id}`);
}
