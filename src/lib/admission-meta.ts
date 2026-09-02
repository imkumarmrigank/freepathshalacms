/**
 * Every option list on the admission form, in one place so the wizard, the
 * review step and the student profile all read the same values.
 * Shared by server and client — nothing server-only in here.
 */

export const STEPS = [
  { key: "student", label: "Student" },
  { key: "contact", label: "Contact" },
  { key: "family", label: "Family" },
  { key: "admission", label: "Admission" },
  { key: "review", label: "Review" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export const GENDERS = ["Male", "Female", "Other"] as const;

export const QUALIFICATIONS = [
  "Uneducated", "3rd Pass", "5th Pass", "8th Pass", "10th Pass",
  "Intermediate", "Graduate", "Post Graduate",
] as const;

export const OCCUPATIONS = [
  "Labor", "Cook", "Auto Driver", "Maid", "Guard", "Mistry", "Painter",
  "Plumber", "Electrician", "Delivery Boy", "Field Boy", "Receptionist", "Other",
] as const;

export const RELIGIONS = [
  "Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other",
] as const;

export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS", "Other"] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const NATIONALITIES = ["Indian", "Other"] as const;

export const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const COUNTRIES = ["India", "Other"] as const;

/** Which parent cards the family step shows. */
export const GUARDIAN_KINDS = [
  { key: "mother", label: "Mother" },
  { key: "father", label: "Father" },
  { key: "guardian", label: "Guardian" },
] as const;

/* ------------------------------------------------------------- validation */

export const ERRORS = {
  required: "Please enter this information.",
  mobile: "Please enter a valid mobile number.",
  email: "Please enter a valid email address.",
  aadhaar: "Please enter a valid Aadhaar number.",
} as const;

export const isMobile = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ""));
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isAadhaar = (v: string) => /^\d{12}$/.test(v.replace(/\D/g, ""));
export const isPincode = (v: string) => /^\d{6}$/.test(v.replace(/\D/g, ""));

/** Aadhaar is shown masked everywhere except the field it was typed into. */
export function maskAadhaar(v: string | null) {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  return d.length === 12 ? `XXXX XXXX ${d.slice(8)}` : v;
}
