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

function Pick({ label, name, value, options, blank = "Select" }: {
  label: string; name: string; value: string; options: readonly string[]; blank?: string;
}) {
  return (
    <Field label={label}>
      <select className="select" name={name} defaultValue={value}>
        <option value="">{blank}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
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

        <Group title="Student">
          <Field label="First name">
            <input className="input" name="first_name" defaultValue={s.first_name} required />
          </Field>
          <Field label="Last name">
            <input className="input" name="last_name" defaultValue={d(s.last_name)} />
          </Field>
          <Field label="Admission no." hint="Set at admission and not editable — the roster is matched on it.">
            <input className="input" value={d(s.admission_no)} disabled readOnly />
          </Field>
          <Field label="Registration no.">
            <input className="input" name="registration_no" defaultValue={d(s.registration_no)} />
          </Field>
          <Field label="Date of birth">
            <input className="input" type="date" name="dob"
              defaultValue={s.dob ? String(s.dob).slice(0, 10) : ""} />
          </Field>
          <Field label="Place of birth">
            <input className="input" name="place_of_birth" defaultValue={d(s.place_of_birth)} />
          </Field>
          <Field label="Gender">
            <select className="select" name="gender" defaultValue={d(s.gender)}>
              <option value="">Select</option><option value="male">Male</option>
              <option value="female">Female</option><option value="other">Other</option>
            </select>
          </Field>
          <Pick label="Blood group" name="blood_group" value={d(s.blood_group)} options={BLOOD_GROUPS} />
          <Pick label="Nationality" name="nationality" value={d(s.nationality)} options={NATIONALITIES} />
          <Pick label="Religion" name="religion" value={d(s.religion)} options={RELIGIONS} />
          <Field label="Caste">
            <input className="input" name="caste" defaultValue={d(s.caste)} />
          </Field>
          <Pick label="Category" name="category" value={d(s.category)} options={CATEGORIES} />
          <Field label="Medium">
            <input className="input" name="medium" defaultValue={d(s.medium)} />
          </Field>
          <Field label="APAAR ID">
            <input className="input" name="apaar_id" defaultValue={d(s.apaar_id)} />
          </Field>
          <Field label="Aadhaar number">
            <input className="input" name="aadhaar_number" inputMode="numeric" maxLength={12}
              defaultValue={d(s.aadhaar_number)} />
          </Field>
          <DocUpload label="Aadhaar card" value={media.aadhaar_media_id}
            onChange={(v) => setDoc("aadhaar_media_id", v)} />
          <Field label="Has a disability">
            <select className="select" name="has_disability"
              defaultValue={s.has_disability ? "yes" : s.has_disability === false ? "no" : ""}>
              <option value="">Not recorded</option>
              <option value="no">No</option><option value="yes">Yes</option>
            </select>
          </Field>
          <Field label="Disability details" wide>
            <input className="input" name="disability_details" defaultValue={d(s.disability_details)} />
          </Field>
          <Field label="Status">
            <select className="select" name="status" defaultValue={s.status}>
              {["active", "inactive", "graduated", "transferred", "dropped"]
                // dropping out has its own control, with a reason attached
                .filter((v) => v !== "dropped" || canDrop || s.status === "dropped")
                .map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
            </select>
          </Field>
        </Group>

        <Group title="Contact & address">
          <Field label="Primary phone">
            <input className="input" name="primary_phone" inputMode="tel" maxLength={10}
              defaultValue={d(s.primary_phone)} />
          </Field>
          <Field label="WhatsApp">
            <input className="input" name="whatsapp_number" inputMode="tel" maxLength={10}
              defaultValue={d(s.whatsapp_number)} />
          </Field>
          <Field label="Alternate phone">
            <input className="input" name="alt_phone" inputMode="tel" maxLength={10}
              defaultValue={d(s.alt_phone)} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" name="email" defaultValue={d(s.email)} />
          </Field>
          <Field label="House / block">
            <input className="input" name="house_block" defaultValue={d(s.house_block)} />
          </Field>
          <Field label="Pincode">
            <input className="input" name="pincode" inputMode="numeric" maxLength={6}
              defaultValue={d(s.pincode)} />
          </Field>
          <Field label="City">
            <input className="input" name="city" defaultValue={d(s.city)} />
          </Field>
          <Pick label="State" name="state" value={d(s.state)} options={STATES} />
          <Pick label="Country" name="country" value={d(s.country)} options={COUNTRIES} />
          <Field label="Address" wide>
            <textarea className="textarea" name="address" rows={2} defaultValue={d(s.address)} />
          </Field>
        </Group>

        {GUARDIAN_KINDS.map((g) => {
          const k = g.key as "mother" | "father" | "guardian";
          const f = (suffix: string) => d((s as unknown as Record<string, unknown>)[`${k}_${suffix}`]);
          return (
            <Group key={k} title={g.label}>
              <Field label="Name">
                <input className="input" name={`${k}_name`} defaultValue={f("name")} />
              </Field>
              <Pick label="Qualification" name={`${k}_qualification`}
                value={f("qualification")} options={QUALIFICATIONS} />
              <Pick label="Occupation" name={`${k}_occupation`}
                value={f("occupation")} options={OCCUPATIONS} />
              <Field label="If other, which">
                <input className="input" name={`${k}_occupation_other`}
                  defaultValue={f("occupation_other")} />
              </Field>
              <Field label="Annual income">
                <input className="input" name={`${k}_income`} inputMode="numeric"
                  defaultValue={f("income")} />
              </Field>
              <Field label="Mobile">
                <input className="input" name={`${k}_mobile`} inputMode="tel" maxLength={10}
                  defaultValue={f("mobile")} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" name={`${k}_email`} defaultValue={f("email")} />
              </Field>
              <Field label="Aadhaar number">
                <input className="input" name={`${k}_aadhaar_number`} inputMode="numeric"
                  maxLength={12} defaultValue={f("aadhaar_number")} />
              </Field>
              <DocUpload label="Aadhaar card" value={media[`${k}_aadhaar_media_id`]}
                onChange={(v) => setDoc(`${k}_aadhaar_media_id`, v)} />
              <Field label="Residential address" wide>
                <textarea className="textarea" rows={2} name={`${k}_residential_address`}
                  defaultValue={f("residential_address")} />
              </Field>
              <Field label="Official address" wide>
                <textarea className="textarea" rows={2} name={`${k}_official_address`}
                  defaultValue={f("official_address")} />
              </Field>
            </Group>
          );
        })}

        <Group title="Notes">
          <Field label="Notes" wide>
            <textarea className="textarea" name="notes" rows={2} defaultValue={d(s.notes)} />
          </Field>
        </Group>

        {!readOnly && <Submit>Save changes</Submit>}
      </fieldset>
    </form>
  );
}
