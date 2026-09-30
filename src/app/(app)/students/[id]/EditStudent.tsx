"use client";
import { useActionState, useState } from "react";
import { updateStudent } from "../actions";
import { Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import DocUpload from "../new/DocUpload";
import {
  BLOOD_GROUPS, CATEGORIES, COUNTRIES, GUARDIAN_KINDS, NATIONALITIES,
  OCCUPATIONS, QUALIFICATIONS, RELIGIONS, STATES,
} from "@/lib/admission-meta";
import type { Student } from "@/lib/types";
import { useT } from "@/components/LocaleProvider";

const d = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 border-t border-[var(--border)] pt-4 first:border-0 first:pt-0">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        {title}
      </h3>
      <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Pick({ label, name, value, options, blank }: {
  label: string; name: string; value: string; options: readonly string[]; blank?: string;
}) {
  const t = useT();
  return (
    <Field label={label}>
      <select className="select" name={name} defaultValue={value}>
        <option value="">{blank ?? t("Select")}</option>
        {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
      </select>
    </Field>
  );
}

/**
 * The admission record, editable.
 *
 * Everything the record shows can be corrected here except two things. The
 * admission number is the centre's own reference and half the roster is matched
 * on it, so changing it would quietly break the link to a child's history.
 * Admission & scheme — the RTE and BPL flags, the leaving date and reason — is
 * left alone too: those are decisions with their own controls and their own
 * audit, not fields to retype.
 */
export default function EditStudent({ s, readOnly, canDrop }:
  { s: Student; readOnly: boolean; canDrop: boolean }) {
  const t = useT();
  const [state, action] = useActionState(updateStudent, null);
  const [media, setMedia] = useState<Record<string, number | null>>({
    aadhaar_media_id: s.aadhaar_media_id ?? null,
    father_aadhaar_media_id: s.father_aadhaar_media_id ?? null,
    mother_aadhaar_media_id: s.mother_aadhaar_media_id ?? null,
    guardian_aadhaar_media_id: s.guardian_aadhaar_media_id ?? null,
  });
  const setDoc = (k: string, v: number | null) => setMedia((m) => ({ ...m, [k]: v }));

  return (
    <form action={action}>
      <input type="hidden" name="id" value={s.id} />
      {Object.entries(media).map(([k, v]) =>
        <input key={k} type="hidden" name={k} value={v ?? ""} />)}
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="contents">

        <Group title={t("Student")}>
          <Field label={t("First name")}>
            <input className="input" name="first_name" defaultValue={s.first_name} required />
          </Field>
          <Field label={t("Last name")}>
            <input className="input" name="last_name" defaultValue={d(s.last_name)} />
          </Field>
          <Field label={t("Admission no.")} hint={t("Set at admission and not editable — the roster is matched on it.")}>
            <input className="input" value={d(s.admission_no)} disabled readOnly />
          </Field>
          <Field label={t("Registration no.")}>
            <input className="input" name="registration_no" defaultValue={d(s.registration_no)} />
          </Field>
          <Field label={t("Date of birth")}>
            <input className="input" type="date" name="dob"
              defaultValue={s.dob ? String(s.dob).slice(0, 10) : ""} />
          </Field>
          <Field label={t("Place of birth")}>
            <input className="input" name="place_of_birth" defaultValue={d(s.place_of_birth)} />
          </Field>
          <Field label={t("Gender")}>
            <select className="select" name="gender" defaultValue={d(s.gender)}>
              <option value="">{t("Select")}</option>
              <option value="male">{t("Male")}</option>
              <option value="female">{t("Female")}</option>
              <option value="other">{t("Other")}</option>
            </select>
          </Field>
          <Pick label={t("Blood group")} name="blood_group" value={d(s.blood_group)} options={BLOOD_GROUPS} />
          <Pick label={t("Nationality")} name="nationality" value={d(s.nationality)} options={NATIONALITIES} />
          <Pick label={t("Religion")} name="religion" value={d(s.religion)} options={RELIGIONS} />
          <Field label={t("Caste")}>
            <input className="input" name="caste" defaultValue={d(s.caste)} />
          </Field>
          <Pick label={t("Category")} name="category" value={d(s.category)} options={CATEGORIES} />
          <Field label={t("Medium of study")}>
            <input className="input" name="medium" defaultValue={d(s.medium)} />
          </Field>
          <Field label={t("APAAR ID")}>
            <input className="input" name="apaar_id" defaultValue={d(s.apaar_id)} />
          </Field>
          <Field label={t("Aadhaar number")}>
            <input className="input" name="aadhaar_number" inputMode="numeric" maxLength={12}
              defaultValue={d(s.aadhaar_number)} />
          </Field>
          <DocUpload label={t("Aadhaar card")} value={media.aadhaar_media_id}
            onChange={(v) => setDoc("aadhaar_media_id", v)} />
          <Field label={t("Has a disability")}>
            <select className="select" name="has_disability"
              defaultValue={s.has_disability ? "yes" : s.has_disability === false ? "no" : ""}>
              <option value="">{t("Not recorded")}</option>
              <option value="no">{t("No")}</option>
              <option value="yes">{t("Yes")}</option>
            </select>
          </Field>
          <Field label={t("Disability details")} wide>
            <input className="input" name="disability_details" defaultValue={d(s.disability_details)} />
          </Field>
          <Field label={t("Status")}>
            <select className="select" name="status" defaultValue={s.status}>
              {["active", "inactive", "suspended", "graduated", "transferred", "dropped"]
                // dropping out has its own control, with a reason attached
                .filter((v) => v !== "dropped" || canDrop || s.status === "dropped")
                .map((v) => (
                  <option key={v} value={v}>{t(v[0].toUpperCase() + v.slice(1))}</option>
                ))}
            </select>
          </Field>
        </Group>

        <Group title={t("Contact & address")}>
          <Field label={t("Primary phone")}>
            <input className="input" name="primary_phone" inputMode="tel" maxLength={10}
              defaultValue={d(s.primary_phone)} />
          </Field>
          <Field label={t("WhatsApp")}>
            <input className="input" name="whatsapp_number" inputMode="tel" maxLength={10}
              defaultValue={d(s.whatsapp_number)} />
          </Field>
          <Field label={t("Alternate phone")}>
            <input className="input" name="alt_phone" inputMode="tel" maxLength={10}
              defaultValue={d(s.alt_phone)} />
          </Field>
          <Field label={t("Email")}>
            <input className="input" type="email" name="email" defaultValue={d(s.email)} />
          </Field>
          <Field label={t("House / block")}>
            <input className="input" name="house_block" defaultValue={d(s.house_block)} />
          </Field>
          <Field label={t("Pincode")}>
            <input className="input" name="pincode" inputMode="numeric" maxLength={6}
              defaultValue={d(s.pincode)} />
          </Field>
          <Field label={t("City")}>
            <input className="input" name="city" defaultValue={d(s.city)} />
          </Field>
          <Pick label={t("State")} name="state" value={d(s.state)} options={STATES} />
          <Pick label={t("Country")} name="country" value={d(s.country)} options={COUNTRIES} />
          <Field label={t("Address")} wide>
            <textarea className="textarea" name="address" rows={2} defaultValue={d(s.address)} />
          </Field>
        </Group>

        {GUARDIAN_KINDS.map((g) => {
          const k = g.key as "mother" | "father" | "guardian";
          const f = (suffix: string) => d((s as unknown as Record<string, unknown>)[`${k}_${suffix}`]);
          return (
            <Group key={k} title={t(g.label)}>
              <Field label={t("Name")}>
                <input className="input" name={`${k}_name`} defaultValue={f("name")} />
              </Field>
              <Pick label={t("Qualification")} name={`${k}_qualification`}
                value={f("qualification")} options={QUALIFICATIONS} />
              <Pick label={t("Occupation")} name={`${k}_occupation`}
                value={f("occupation")} options={OCCUPATIONS} />
              <Field label={t("If other, which")}>
                <input className="input" name={`${k}_occupation_other`}
                  defaultValue={f("occupation_other")} />
              </Field>
              <Field label={t("Annual income")}>
                <input className="input" name={`${k}_income`} inputMode="numeric"
                  defaultValue={f("income")} />
              </Field>
              <Field label={t("Mobile")}>
                <input className="input" name={`${k}_mobile`} inputMode="tel" maxLength={10}
                  defaultValue={f("mobile")} />
              </Field>
              <Field label={t("Email")}>
                <input className="input" type="email" name={`${k}_email`} defaultValue={f("email")} />
              </Field>
              <Field label={t("Aadhaar number")}>
                <input className="input" name={`${k}_aadhaar_number`} inputMode="numeric"
                  maxLength={12} defaultValue={f("aadhaar_number")} />
              </Field>
              <DocUpload label={t("Aadhaar card")} value={media[`${k}_aadhaar_media_id`]}
                onChange={(v) => setDoc(`${k}_aadhaar_media_id`, v)} />
              <Field label={t("Residential address")} wide>
                <textarea className="textarea" rows={2} name={`${k}_residential_address`}
                  defaultValue={f("residential_address")} />
              </Field>
              <Field label={t("Official address")} wide>
                <textarea className="textarea" rows={2} name={`${k}_official_address`}
                  defaultValue={f("official_address")} />
              </Field>
            </Group>
          );
        })}

        <Group title={t("Notes")}>
          <Field label={t("Notes")} wide>
            <textarea className="textarea" name="notes" rows={2} defaultValue={d(s.notes)} />
          </Field>
        </Group>

        {!readOnly && <Submit>{t("Save changes")}</Submit>}
      </fieldset>
    </form>
  );
}
