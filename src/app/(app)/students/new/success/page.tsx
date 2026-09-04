import Link from "next/link";
import { notFound } from "next/navigation";
import { canTouchCenter, requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { Alert, Card, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";

export const metadata = { title: "Admission successful · Pehchaan" };

export default async function AdmissionSuccessPage({
  searchParams,
}: { searchParams: Promise<{ student?: string }> }) {
  const user = await requireUser();
  const { student: studentParam } = await searchParams;
  if (!studentParam) notFound();

  const s = await one<{
    id: number; first_name: string; last_name: string | null; enrollment_no: string;
    admission_no: string | null; registration_no: string | null; center_id: number;
    center_name: string; class_name: string | null; photo_media_id: number | null;
  }>(
    `SELECT s.id, s.first_name, s.last_name, s.enrollment_no, s.admission_no,
            s.registration_no, s.center_id, c.name AS center_name,
            cl.name AS class_name, s.photo_media_id
       FROM students s
       JOIN centers c ON c.id = s.center_id
       LEFT JOIN enrollments e ON e.student_id = s.id
       LEFT JOIN class_levels cl ON cl.id = e.class_level_id
      WHERE s.id = $1
      ORDER BY e.id DESC LIMIT 1`,
    [Number(studentParam)],
  );
  if (!s) notFound();
  if (!canTouchCenter(user, s.center_id))
    return <Alert kind="bad">This student belongs to another centre.</Alert>;

  const rows: [string, string][] = [
    ["Student Name", fullName(s)],
    ["Student ID", s.enrollment_no],
    ["Admission Number", s.admission_no ?? "—"],
    ["Registration Number", s.registration_no ?? "—"],
    ["Class", s.class_name ?? "—"],
    ["Centre", s.center_name],
  ];

  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader title="Admission Successful"
        subtitle="The student has been successfully registered with Pehchaan." />

      <Card>
        <div className="mb-4 flex items-center gap-4">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-[var(--ok-soft)] text-[22px] text-[#15803d]">
            ✓
          </span>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold">{fullName(s)}</div>
            <div className="text-[13px] text-[var(--muted)]">
              Keep the Student ID and Admission Number for your records.
            </div>
          </div>
        </div>

        <dl className="rounded-[9px] border border-[var(--border)]">
          {rows.map(([k, v], i) => (
            <div key={k}
              className={`flex justify-between gap-4 px-3.5 py-2.5 ${
                i < rows.length - 1 ? "border-b border-[#f1f1f6]" : ""}`}>
              <dt className="text-[13px] text-[var(--muted)]">{k}</dt>
              <dd className="text-right text-[13px] font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href={`/students/${s.id}`} className="btn btn-primary">View Student Profile</Link>
          <Link href="/students/new" className="btn btn-ghost">Add Another Student</Link>
        </div>
      </Card>
    </div>
  );
}
