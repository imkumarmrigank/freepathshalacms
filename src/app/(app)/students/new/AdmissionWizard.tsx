"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card } from "@/components/ui";
import PhotoUpload from "./PhotoUpload";
import { saveDraft, submitAdmission, type AdmissionPayload } from "./actions";
import {
  BLOOD_GROUPS, CATEGORIES, COUNTRIES, GENDERS, GUARDIAN_KINDS, NATIONALITIES,
  OCCUPATIONS, QUALIFICATIONS, RELIGIONS, STATES, STEPS, maskAadhaar,
} from "@/lib/admission-meta";

type Ref = { id: number; name: string; code?: string };

/* ------------------------------------------------------------ small pieces */

function Text({
  label, name, value, onChange, required, placeholder, type = "text", hint, error, ...rest
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  required?: boolean; placeholder?: string; type?: string; hint?: string; error?: string;
  maxLength?: number; inputMode?: "text" | "numeric" | "tel" | "email";
}) {
  return (
    <label className="field">
      <span>{label}{required && " *"}</span>
      <input
        className="input" name={name} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: "var(--bad)" } : undefined}
        {...rest}
      />
      {error
        ? <span className="mt-1 block text-[12px] font-normal text-[var(--bad)]">{error}</span>
        : hint && <span className="mt-1 block text-[12px] font-normal text-[var(--faint)]">{hint}</span>}
    </label>
  );
}

function Select({
  label, name, value, onChange, options, required, placeholder = "Select", hint,
}: {
  label: string; name: string; value: string;
  onChange: (v: string) => void;
  options: readonly string[] | Ref[];
  required?: boolean; placeholder?: string; hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}{required && " *"}</span>
      <select className="select" name={name} value={value}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) =>
          typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.id} value={o.id}>{o.code ? `${o.code} · ${o.name}` : o.name}</option>)}
      </select>
      {hint && <span className="mt-1 block text-[12px] font-normal text-[var(--faint)]">{hint}</span>}
    </label>
  );
}

function YesNo({
  label, value, onChange,
}: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="flex gap-4 pt-1">
        {[["Yes", true], ["No", false]].map(([txt, val]) => (
          <label key={String(txt)} className="flex items-center gap-2 text-[13px]">
            <input type="radio" className="h-4 w-4" checked={value === val}
              onChange={() => onChange(val as boolean)} />
            {txt}
          </label>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#f1f1f6] py-1.5 last:border-0">
      <dt className="text-[13px] text-[var(--muted)]">{label}</dt>
      <dd className="text-right text-[13px] font-medium">{value || "—"}</dd>
    </div>
  );
}

/* ------------------------------------------------------------- the wizard */

export default function AdmissionWizard({
  centers, classes, sessionName, draft, draftId: initialDraftId,
}: {
  centers: Ref[];
  classes: Ref[];
  sessionName: string;
  draft: AdmissionPayload | null;
  draftId: number | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<AdmissionPayload>(() => ({
    country: "India", nationality: "Indian",
    admission_date: new Date().toISOString().slice(0, 10),
    center_id: centers.length === 1 ? String(centers[0].id) : "",
    ...(draft ?? {}),
  }));
  const [draftId, setDraftId] = useState<number | null>(initialDraftId);
  const [openCard, setOpenCard] = useState<string | null>("mother");
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const v = (k: string) => (data[k] === undefined || data[k] === null ? "" : String(data[k]));
  const set = (k: string, val: unknown) => {
    setData((d) => ({ ...d, [k]: val }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const centreName = centers.find((c) => String(c.id) === v("center_id"))?.name ?? "";
  const className = classes.find((c) => String(c.id) === v("class_level_id"))?.name ?? "";

  /** Only the starred fields block moving on. */
  function validate(which: number): boolean {
    const e: Record<string, string> = {};
    if (which === 0) {
      if (!v("first_name")) e.first_name = "Please enter this information.";
      if (!v("dob")) e.dob = "Please enter this information.";
      if (!v("gender")) e.gender = "Please enter this information.";
    }
    if (which === 1) {
      if (!v("primary_phone")) e.primary_phone = "Please enter this information.";
      else if (!/^[6-9]\d{9}$/.test(v("primary_phone").replace(/\D/g, "")))
        e.primary_phone = "Please enter a valid mobile number.";
      if (v("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email")))
        e.email = "Please enter a valid email address.";
      if (!v("address")) e.address = "Please enter this information.";
      if (!v("pincode")) e.pincode = "Please enter this information.";
      else if (!/^\d{6}$/.test(v("pincode").replace(/\D/g, "")))
        e.pincode = "Please enter a valid pincode.";
      if (!v("city")) e.city = "Please enter this information.";
      if (!v("state")) e.state = "Please enter this information.";
    }
    if (which === 3) {
      if (!v("admission_date")) e.admission_date = "Please enter this information.";
      if (!v("class_level_id")) e.class_level_id = "Please enter this information.";
      if (!v("center_id")) e.center_id = "Please enter this information.";
      if (v("aadhaar_number") && !/^\d{12}$/.test(v("aadhaar_number").replace(/\D/g, "")))
        e.aadhaar_number = "Please enter a valid Aadhaar number.";
    }
    setErrors(e);
    if (Object.keys(e).length) {
      setMessage({ kind: "bad", text: "Please correct the highlighted fields." });
      return false;
    }
    setMessage(null);
    return true;
  }

  const goNext = () => { if (validate(step)) setStep((x) => Math.min(x + 1, STEPS.length - 1)); };
  const goBack = () => { setMessage(null); setStep((x) => Math.max(x - 1, 0)); };

  const onSaveDraft = () =>
    start(async () => {
      const res = await saveDraft(data, draftId);
      if (res.error) setMessage({ kind: "bad", text: res.error });
      else {
        if (res.draftId) setDraftId(res.draftId);
        setMessage({ kind: "ok", text: "Admission saved as draft. You can finish it later from Students." });
      }
    });

  const onSubmit = () =>
    start(async () => {
      const res = await submitAdmission(data, draftId);
      if (res?.error) {
        setMessage({ kind: "bad", text: res.error });
        if (typeof res.step === "number") setStep(res.step);
      }
      router.refresh();
    });

  /* ------------------------------------------------------ parent/guardian card */
  function PersonCard({ kind, label }: { kind: string; label: string }) {
    const open = openCard === kind;
    const filled = Boolean(v(`${kind}_name`));
    return (
      <div className="mb-3 overflow-hidden rounded-[10px] border border-[var(--border)]">
        <button type="button"
          onClick={() => setOpenCard(open ? null : kind)}
          className="flex w-full items-center justify-between gap-3 bg-[#fafaff] px-4 py-3 text-left">
          <span className="text-[14px] font-medium">
            {label}’s Details
            {filled && <span className="ml-2 text-[12px] font-normal text-[var(--muted)]">
              {v(`${kind}_name`)}
            </span>}
          </span>
          <span className="text-[13px] text-[var(--muted)]">{open ? "Hide" : "Edit"}</span>
        </button>
        {open && (
          <div className="px-4 pb-1 pt-4">
            <PhotoUpload label={`${label} Photo`} size={88}
              value={data[`${kind}_photo_media_id`] as number ?? null}
              onChange={(id) => set(`${kind}_photo_media_id`, id)} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Text label={`${label} Name`} name={`${kind}_name`} value={v(`${kind}_name`)}
                placeholder={`Enter ${label.toLowerCase()}'s full name`}
                onChange={(x) => set(`${kind}_name`, x)} />
              <Select label="Qualification" name={`${kind}_qualification`}
                value={v(`${kind}_qualification`)} options={QUALIFICATIONS}
                placeholder="Select Qualification"
                onChange={(x) => set(`${kind}_qualification`, x)} />
              <Select label="Occupation" name={`${kind}_occupation`}
                value={v(`${kind}_occupation`)} options={OCCUPATIONS}
                placeholder="Select Occupation"
                onChange={(x) => set(`${kind}_occupation`, x)} />
              {v(`${kind}_occupation`) === "Other" && (
                <Text label="Please specify occupation" name={`${kind}_occupation_other`}
                  value={v(`${kind}_occupation_other`)} placeholder="Enter occupation"
                  onChange={(x) => set(`${kind}_occupation_other`, x)} />
              )}
              <Text label="Annual Income" name={`${kind}_income`} value={v(`${kind}_income`)}
                inputMode="numeric" placeholder="Enter annual income"
                onChange={(x) => set(`${kind}_income`, x)} />
              <Text label="Email" name={`${kind}_email`} value={v(`${kind}_email`)}
                type="email" placeholder="Enter email address"
                onChange={(x) => set(`${kind}_email`, x)} />
              <Text label="Mobile Number" name={`${kind}_mobile`} value={v(`${kind}_mobile`)}
                inputMode="tel" maxLength={10} placeholder="Enter mobile number"
                onChange={(x) => set(`${kind}_mobile`, x)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* -------------------------------------------------------- progress */}
      <Card className="mb-5">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {STEPS.map((st, i) => {
            const state = i === step ? "current" : i < step ? "done" : "todo";
            return (
              <li key={st.key} className="flex items-center gap-2">
                <button type="button" onClick={() => i < step && setStep(i)}
                  className="flex items-center gap-2"
                  aria-current={state === "current" ? "step" : undefined}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold ${
                    state === "current" ? "bg-[var(--brand)] text-white"
                      : state === "done" ? "bg-[var(--ok-soft)] text-[#15803d]"
                      : "bg-[#f1f1f6] text-[var(--muted)]"}`}>
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={`text-[13px] ${
                    state === "current" ? "font-semibold" : "text-[var(--muted)]"}`}>
                    {st.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="mx-1 hidden h-px w-8 bg-[var(--border-strong)] sm:block" />
                )}
              </li>
            );
          })}
        </ol>
      </Card>

      {message && (
        <div className="mb-4">
          <Alert kind={message.kind === "ok" ? "ok" : "bad"}>{message.text}</Alert>
        </div>
      )}

      {/* ------------------------------------------------ 1. student details */}
      {step === 0 && (
        <Card>
          <SectionTitle title="Student Information" />
          <PhotoUpload label="Student Photo" hint="Upload a clear passport-size photograph."
            value={data.photo_media_id as number ?? null}
            onChange={(id) => set("photo_media_id", id)} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Text label="Student Name" name="first_name" required value={v("first_name")}
              placeholder="Enter student's full name" error={errors.first_name}
              onChange={(x) => set("first_name", x)} />
            <Text label="Surname" name="last_name" value={v("last_name")}
              placeholder="Enter surname" onChange={(x) => set("last_name", x)} />
            <Text label="Date of Birth" name="dob" required type="date" value={v("dob")}
              error={errors.dob} onChange={(x) => set("dob", x)} />
            <Select label="Gender" name="gender" required value={v("gender")}
              options={GENDERS} placeholder="Select Gender"
              onChange={(x) => set("gender", x)} />
            <Text label="Place of Birth" name="place_of_birth" value={v("place_of_birth")}
              placeholder="Enter place of birth" onChange={(x) => set("place_of_birth", x)} />
            <Select label="Nationality" name="nationality" value={v("nationality")}
              options={NATIONALITIES} placeholder="Select Nationality"
              onChange={(x) => set("nationality", x)} />
            <Select label="Religion" name="religion" value={v("religion")}
              options={RELIGIONS} placeholder="Select Religion"
              onChange={(x) => set("religion", x)} />
            <Text label="Caste" name="caste" value={v("caste")}
              placeholder="Enter caste" onChange={(x) => set("caste", x)} />
            <Select label="Category" name="category" value={v("category")}
              options={CATEGORIES} placeholder="Select Category"
              onChange={(x) => set("category", x)} />
            <Select label="Blood Group" name="blood_group" value={v("blood_group")}
              options={BLOOD_GROUPS} placeholder="Select Blood Group"
              onChange={(x) => set("blood_group", x)} />
          </div>
          <YesNo label="Has Disability?" value={(data.has_disability as boolean) ?? null}
            onChange={(x) => set("has_disability", x)} />
          {data.has_disability === true && (
            <Text label="Disability Details" name="disability_details"
              value={v("disability_details")} placeholder="Enter disability details"
              onChange={(x) => set("disability_details", x)} />
          )}
        </Card>
      )}

      {/* ------------------------------------------------- 2. contact */}
      {step === 1 && (
        <>
          <Card className="mb-5">
            <SectionTitle title="Student Contact" />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Text label="Mobile Number" name="primary_phone" required inputMode="tel"
                maxLength={10} value={v("primary_phone")} placeholder="Enter mobile number"
                error={errors.primary_phone} onChange={(x) => set("primary_phone", x)} />
              <Text label="WhatsApp Number" name="whatsapp_number" inputMode="tel" maxLength={10}
                value={v("whatsapp_number")} placeholder="Enter WhatsApp number"
                onChange={(x) => set("whatsapp_number", x)} />
            </div>
            <label className="mb-4 flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="h-4 w-4"
                checked={v("whatsapp_number") !== "" && v("whatsapp_number") === v("primary_phone")}
                onChange={(e) => set("whatsapp_number", e.target.checked ? v("primary_phone") : "")} />
              WhatsApp number is same as Mobile Number
            </label>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Text label="Alternate Number" name="alt_phone" inputMode="tel" maxLength={10}
                value={v("alt_phone")} placeholder="Enter alternate mobile number"
                onChange={(x) => set("alt_phone", x)} />
              <Text label="Email Address" name="email" type="email" value={v("email")}
                placeholder="Enter email address" error={errors.email}
                onChange={(x) => set("email", x)} />
            </div>
          </Card>

          <Card>
            <SectionTitle title="Residential Address" />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Text label="House / Block" name="house_block" value={v("house_block")}
                placeholder="Enter house or block" onChange={(x) => set("house_block", x)} />
              <Text label="Pincode" name="pincode" required inputMode="numeric" maxLength={6}
                value={v("pincode")} placeholder="Enter pincode" error={errors.pincode}
                onChange={(x) => set("pincode", x)} />
            </div>
            <label className="field">
              <span>Address *</span>
              <textarea className="textarea" rows={2} value={v("address")}
                placeholder="Enter complete residential address"
                style={errors.address ? { borderColor: "var(--bad)" } : undefined}
                onChange={(e) => set("address", e.target.value)} />
              {errors.address && (
                <span className="mt-1 block text-[12px] font-normal text-[var(--bad)]">
                  {errors.address}
                </span>
              )}
            </label>
            <div className="grid gap-x-4 sm:grid-cols-3">
              <Text label="City" name="city" required value={v("city")}
                placeholder="Enter city" error={errors.city}
                onChange={(x) => set("city", x)} />
              <Select label="State" name="state" required value={v("state")}
                options={STATES} placeholder="Select State"
                onChange={(x) => set("state", x)} />
              <Select label="Country" name="country" value={v("country")}
                options={COUNTRIES} placeholder="Select Country"
                onChange={(x) => set("country", x)} />
            </div>
            {errors.state && <p className="text-[12px] text-[var(--bad)]">{errors.state}</p>}
          </Card>
        </>
      )}

      {/* -------------------------------------------------- 3. family */}
      {step === 2 && (
        <Card>
          <SectionTitle title="Parent / Guardian Information"
            sub="Add the details of the student's parents or guardian." />
          {GUARDIAN_KINDS.map((g) => (
            <PersonCard key={g.key} kind={g.key} label={g.label} />
          ))}
        </Card>
      )}

      {/* ----------------------------------------------- 4. admission */}
      {step === 3 && (
        <>
          <Card className="mb-5">
            <SectionTitle title="Admission Information" sub={`Session ${sessionName}`} />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <label className="field">
                <span>Admission Number</span>
                <input className="input" value="Auto-generated" readOnly disabled />
              </label>
              <Text label="Registration Number" name="registration_no" value={v("registration_no")}
                placeholder="Auto-generated / Enter registration number"
                onChange={(x) => set("registration_no", x)} />
              <Text label="Admission Date" name="admission_date" required type="date"
                value={v("admission_date")} error={errors.admission_date}
                onChange={(x) => set("admission_date", x)} />
              <Select label="Class" name="class_level_id" required value={v("class_level_id")}
                options={classes} placeholder="Select Class"
                onChange={(x) => set("class_level_id", x)} />
              <Select label="Centre" name="center_id" required value={v("center_id")}
                options={centers} placeholder="Select Centre"
                hint="Centres you add appear here automatically"
                onChange={(x) => set("center_id", x)} />
              <Text label="Section" name="section" value={v("section")}
                placeholder="A" onChange={(x) => set("section", x)} />
            </div>
            {(errors.class_level_id || errors.center_id) && (
              <p className="text-[12px] text-[var(--bad)]">Please choose a class and a centre.</p>
            )}
            <YesNo label="UDISE" value={(data.udise as boolean) ?? null}
              onChange={(x) => set("udise", x)} />
            <Text label="RTE Application Number" name="rte_application_no"
              value={v("rte_application_no")} placeholder="Enter RTE application number"
              onChange={(x) => set("rte_application_no", x)} />
          </Card>

          <Card>
            <SectionTitle title="Identification Details" />
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Text label="APAAR ID" name="apaar_id" value={v("apaar_id")}
                placeholder="Enter APAAR ID" onChange={(x) => set("apaar_id", x)} />
              <Text label="Aadhaar Number" name="aadhaar_number" inputMode="numeric" maxLength={12}
                value={v("aadhaar_number")} placeholder="Enter Aadhaar number"
                error={errors.aadhaar_number} onChange={(x) => set("aadhaar_number", x)} />
            </div>
          </Card>
        </>
      )}

      {/* ------------------------------------------------- 5. review */}
      {step === 4 && (
        <>
          <Card className="mb-5">
            <SectionTitle title="Review Student Details"
              sub="Please review the information before submitting the admission." />
            <div className="flex items-start gap-4">
              <div className="h-[92px] w-[92px] flex-none overflow-hidden rounded-[10px] border border-[var(--border)] bg-[#fafaff]">
                {data.photo_media_id ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/media/${data.photo_media_id}`} alt=""
                    className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-[11px] text-[var(--faint)]">
                    No photo
                  </span>
                )}
              </div>
              <dl className="min-w-0 flex-1">
                <ReviewRow label="Student Name" value={`${v("first_name")} ${v("last_name")}`.trim()} />
                <ReviewRow label="Date of Birth" value={v("dob")} />
                <ReviewRow label="Gender" value={v("gender")} />
                <ReviewRow label="Class" value={className} />
                <ReviewRow label="Centre" value={centreName} />
              </dl>
            </div>
            <button type="button" className="btn btn-ghost btn-sm mt-3"
              onClick={() => setStep(0)}>Edit Student Details</button>
          </Card>

          <Card className="mb-5">
            <SectionTitle title="Contact Details" />
            <dl>
              <ReviewRow label="Mobile" value={v("primary_phone")} />
              <ReviewRow label="WhatsApp" value={v("whatsapp_number")} />
              <ReviewRow label="Email" value={v("email")} />
              <ReviewRow label="Address" value={
                [v("house_block"), v("address"), v("city"), v("state"), v("pincode")]
                  .filter(Boolean).join(", ")} />
            </dl>
            <button type="button" className="btn btn-ghost btn-sm mt-3"
              onClick={() => setStep(1)}>Edit Contact Details</button>
          </Card>

          <Card className="mb-5">
            <SectionTitle title="Family Details" />
            <dl>
              {GUARDIAN_KINDS.map((g) => (
                <ReviewRow key={g.key} label={g.label} value={
                  [v(`${g.key}_name`), v(`${g.key}_qualification`),
                   v(`${g.key}_occupation`) === "Other"
                     ? v(`${g.key}_occupation_other`) : v(`${g.key}_occupation`)]
                    .filter(Boolean).join(" · ")} />
              ))}
            </dl>
            <button type="button" className="btn btn-ghost btn-sm mt-3"
              onClick={() => setStep(2)}>Edit Family Details</button>
          </Card>

          <Card className="mb-5">
            <SectionTitle title="Admission Details" />
            <dl>
              <ReviewRow label="Admission Date" value={v("admission_date")} />
              <ReviewRow label="Class" value={className} />
              <ReviewRow label="Centre" value={centreName} />
              <ReviewRow label="Registration Number"
                value={v("registration_no") || "Auto-generated on submit"} />
              <ReviewRow label="RTE Application Number" value={v("rte_application_no")} />
              <ReviewRow label="UDISE" value={
                data.udise === true ? "Yes" : data.udise === false ? "No" : ""} />
            </dl>
            <SectionTitle title="Identification" />
            <dl>
              <ReviewRow label="APAAR ID" value={v("apaar_id")} />
              <ReviewRow label="Aadhaar Number"
                value={v("aadhaar_number") ? maskAadhaar(v("aadhaar_number")) : ""} />
            </dl>
            <button type="button" className="btn btn-ghost btn-sm mt-3"
              onClick={() => setStep(3)}>Edit Admission Details</button>
          </Card>

          <Card>
            <SectionTitle title="Declaration & Consent" />
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 h-4 w-4"
                checked={data.declaration === true}
                onChange={(e) => set("declaration", e.target.checked)} />
              I confirm that the information provided above is correct to the best of my
              knowledge and belief.
            </label>
          </Card>
        </>
      )}

      {/* -------------------------------------------------- bottom actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={goBack} disabled={pending}>
            ← Back
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onSaveDraft} disabled={pending}>
          Save as Draft
        </button>
        <span className="flex-1" />
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={goNext} disabled={pending}>
            Continue →
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onSubmit}
            disabled={pending || data.declaration !== true}>
            {pending ? "Submitting…" : "Submit Admission"}
          </button>
        )}
      </div>
    </>
  );
}
