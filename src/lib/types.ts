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
};
