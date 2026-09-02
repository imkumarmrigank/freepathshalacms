import { Avatar } from "@/components/ui";
import { fmtDate, titleCase } from "@/lib/format";
import { maskAadhaar } from "@/lib/admission-meta";
import type { Student } from "@/lib/types";

/**
 * Everything held against a student that the short edit form above does not
 * show — the rest of the admission wizard, plus the fields carried over from
 * the centres' previous roster. Rows with nothing in them are dropped, so a
 * thinly-filled record stays short instead of showing a wall of dashes.
 */

type Row = [label: string, value: string | null | undefined];

const yesNo = (v: boolean | null | undefined) =>
  v === null || v === undefined ? null : v ? "Yes" : "No";

const money = (v: string | null) =>
  v === null || v === "" ? null : `₹${Number(v).toLocaleString("en-IN")}`;

/** "Other" occupations keep the wording the centre actually typed. */
const occupation = (v: string | null, other: string | null) =>
  v === "Other" && other ? `Other — ${other}` : v;

function Section({ title, rows, aside }:
  { title: string; rows: Row[]; aside?: React.ReactNode }) {
  const filled = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filled.length === 0 && !aside) return null;
  return (
    <section className="border-t border-[#f1f1f6] pt-4 first:border-0 first:pt-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="label-cap">{title}</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
            {filled.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {aside}
      </div>
    </section>
  );
}

export default function AdmissionRecord({ s }: { s: Student }) {
  const photo = (id: number | null) => (id ? `/api/media/${id}` : null);

  const parent = (kind: "mother" | "father" | "guardian"): [string, Row[], number | null] => {
    const p = <K extends string>(f: K) => `${kind}_${f}` as keyof Student;
    const g = (f: string) => (s[p(f)] ?? null) as string | null;
    return [
      titleCase(kind),
      [
        ["Name", (s[`${kind}_name` as keyof Student] ?? null) as string | null],
        ["Qualification", g("qualification")],
        ["Occupation", occupation(g("occupation"), g("occupation_other"))],
        ["Annual income", money(g("income"))],
        ["Mobile", g("mobile")],
        ["Email", g("email")],
        ["Aadhaar", g("aadhaar_number") ? maskAadhaar(g("aadhaar_number")) : null],
        ["Residential address", g("residential_address")],
        ["Official address", g("official_address")],
      ],
      (s[p("photo_media_id")] ?? null) as number | null,
    ];
  };

  return (
    <div className="space-y-4">
      <Section
        title="Student"
        rows={[
          ["Admission no.", s.admission_no],
          ["Registration no.", s.registration_no],
          ["Date of birth", s.dob ? fmtDate(s.dob) : null],
          ["Place of birth", s.place_of_birth],
          ["Gender", s.gender ? titleCase(s.gender) : null],
          ["Blood group", s.blood_group],
          ["Nationality", s.nationality],
          ["Religion", s.religion],
          ["Caste", s.caste],
          ["Category", s.category],
          ["Medium", s.medium],
          ["Aadhaar", s.aadhaar_number ? maskAadhaar(s.aadhaar_number) : null],
          ["APAAR ID", s.apaar_id],
          ["Disability", yesNo(s.has_disability)],
          ["Disability details", s.disability_details],
        ]}
        aside={
          s.photo_media_id
            ? <Avatar name={s.first_name} size={92} src={photo(s.photo_media_id)} />
            : undefined
        }
      />

      <Section
        title="Contact & address"
        rows={[
          ["Mobile", s.primary_phone],
          ["WhatsApp", s.whatsapp_number],
          ["Alternate", s.alt_phone],
          ["Email", s.email],
          ["House / block", s.house_block],
          ["Pincode", s.pincode],
          ["City", s.city],
          ["State", s.state],
          ["Country", s.country],
        ]}
      />

      {(["mother", "father", "guardian"] as const).map((kind) => {
        const [title, rows, photoId] = parent(kind);
        return (
          <Section
            key={kind}
            title={title}
            rows={rows}
            aside={photoId
              ? <Avatar name={title} size={72} src={photo(photoId)} />
              : undefined}
          />
        );
      })}

      <Section
        title="Admission & scheme"
        rows={[
          ["Admitted on", fmtDate(s.admission_date)],
          ["Status", titleCase(s.status)],
          ["RTE student", s.is_rte ? "Yes" : null],
          ["RTE application no.", s.rte_application_no],
          ["BPL family", s.is_bpl ? "Yes" : null],
          ["UDISE", yesNo(s.udise)],
          ["DOB application no.", s.dob_application_no],
          ["Samagra ID", s.samagra_id],
          ["Referred by", s.reference],
          ["Transfer certificate", s.tc_date ? fmtDate(s.tc_date) : null],
          ["Left on", s.dropout_date ? fmtDate(s.dropout_date) : null],
          ["Reason for leaving", s.dropout_reason],
          ["Previous roster ID", s.legacy_student_id],
        ]}
      />
    </div>
  );
}
