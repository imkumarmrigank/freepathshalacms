export type Student = {
  id: number;
  enrollment_no: string;
  center_id: number;
  first_name: string;
  last_name: string | null;
  gender: string | null;
  dob: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  primary_phone: string | null;
  alt_phone: string | null;
  email: string | null;
  address: string | null;
  admission_date: string;
  status: string;
  notes: string | null;

  /* the rest of the admission record — everything the wizard collects, plus the
     fields the centres' previous roster carried (see migration 016). */
  admission_no: string | null;
  registration_no: string | null;
  photo_media_id: number | null;
  place_of_birth: string | null;
  nationality: string | null;
  religion: string | null;
  caste: string | null;
  category: string | null;
  blood_group: string | null;
  has_disability: boolean;
  disability_details: string | null;
  whatsapp_number: string | null;
  house_block: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  udise: boolean | null;
  rte_application_no: string | null;
  apaar_id: string | null;
  aadhaar_number: string | null;

  mother_qualification: string | null;
  mother_occupation: string | null;
  mother_occupation_other: string | null;
  mother_income: string | null;
  mother_email: string | null;
  mother_mobile: string | null;
  mother_photo_media_id: number | null;
  mother_aadhaar_number: string | null;
  mother_residential_address: string | null;
  mother_official_address: string | null;

  father_qualification: string | null;
  father_occupation: string | null;
  father_occupation_other: string | null;
  father_income: string | null;
  father_email: string | null;
  father_mobile: string | null;
  father_photo_media_id: number | null;
  father_aadhaar_number: string | null;
  father_residential_address: string | null;
  father_official_address: string | null;

  guardian_qualification: string | null;
  guardian_occupation: string | null;
  guardian_occupation_other: string | null;
  guardian_income: string | null;
  guardian_email: string | null;
  guardian_mobile: string | null;
  guardian_photo_media_id: number | null;
  guardian_aadhaar_number: string | null;
  guardian_residential_address: string | null;
  guardian_official_address: string | null;

  legacy_student_id: string | null;
  medium: string | null;
  is_rte: boolean;
  is_bpl: boolean;
  dob_application_no: string | null;
  samagra_id: string | null;
  reference: string | null;
  tc_date: string | null;
  dropout_reason: string | null;
  dropout_date: string | null;
};
