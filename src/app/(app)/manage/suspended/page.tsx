import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { listClasses } from "@/lib/queries";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import Reactivate from "./Reactivate";

export const metadata = { title: "Suspended students · Pehchaan" };

const TABS = [
  { value: "suspended", label: "Suspended" },
  { value: "graduated", label: "Passed out" },
] as const;

export default async function SuspendedPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; center?: string; q?: string }> }) {
  await requireRole("super_admin", "admin");
  const sp = await searchParams;
  const tab = sp.tab === "graduated" ? "graduated" : "suspended";
  const centerId = Number(sp.center) || null;
  const q = (sp.q ?? "").trim();

  const params: unknown[] = [tab];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND s.center_id = $${params.length}`; }
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (s.first_name || ' ' || COALESCE(s.last_name,'') || ' ' || s.enrollment_no
                    || ' ' || COALESCE(s.admission_no,'') || ' ' || COALESCE(s.father_name,''))
                   ILIKE $${params.length}`;
  }

  const [rows, counts, centres, classes] = await Promise.all([
    query<{
      id: number; name: string; enrollment_no: string; admission_no: string | null;
      father_name: string | null; primary_phone: string | null; center_id: number;
      center_name: string; class_id: number | null; class_name: string | null;
      left_on: string | null; left_reason: string | null;
    }>(
      `SELECT s.id, trim(s.first_name || ' ' || COALESCE(s.last_name, '')) AS name,
              s.enrollment_no, s.admission_no, s.father_name, s.primary_phone,
              s.center_id, c.name AS center_name,
              last.class_level_id AS class_id, cl.name AS class_name,
              s.left_on, s.left_reason
         FROM students s
         JOIN centers c ON c.id = s.center_id
         LEFT JOIN LATERAL (
           SELECT e.class_level_id FROM enrollments e
            WHERE e.student_id = s.id ORDER BY e.session_id DESC LIMIT 1
         ) last ON TRUE
         LEFT JOIN class_levels cl ON cl.id = last.class_level_id
        WHERE s.status = $1 ${where}
        ORDER BY c.code, name
        LIMIT 1000`,
      params),
    query<{ status: string; n: number }>(
      `SELECT status, count(*)::int AS n FROM students
        WHERE status IN ('suspended','graduated') GROUP BY status`),
    query<{ id: number; code: string; name: string }>(
      "SELECT id, code, name FROM centers WHERE is_active ORDER BY code"),
    listClasses(),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?.n ?? 0;
  const link = (over: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const merged = { tab, center: centerId ? String(centerId) : null, q: q || null, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    return `/manage/suspended?${next.toString()}`;
  };

  return (
    <>
      <PageHeader title="Suspended students"
        subtitle="Children off the roll who may come back — bring them back at the right centre and class" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Suspended" value={count("suspended")} hint="expected to be able to return" />
        <StatCard label="Passed out" value={count("graduated")} hint="moved on to a formal school" />
        <StatCard label="Showing" value={rows.length}
          hint={centerId ? centres.find((c) => c.id === centerId)?.name ?? "" : "all centres"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.value} href={link({ tab: t.value })}
            className={`btn btn-sm ${tab === t.value ? "btn-primary" : "btn-ghost"}`}>
            {t.label} ({count(t.value)})
          </Link>
        ))}
        <form className="ml-auto flex flex-wrap gap-2" action="/manage/suspended">
          <input type="hidden" name="tab" value={tab} />
          <select className="select w-auto py-1.5 text-[13px]" name="center" defaultValue={centerId ?? ""}>
            <option value="">All centres</option>
            {centres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
          <input className="input w-[220px] py-1.5 text-[13px]" name="q" defaultValue={q}
            placeholder="Name, enrolment or father" />
          <button className="btn btn-ghost btn-sm" type="submit">Filter</button>
        </form>
      </div>

      <Card pad={false}>
        {rows.length === 0 ? (
          <Empty title="Nobody here" hint={q || centerId ? "Try a different filter." : "No children have this status."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th><th>Last centre</th><th>Last class</th>
                  <th>Since</th><th>{tab === "graduated" ? "Went to" : "Reason"}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/students/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      <div className="font-mono text-[11px] text-[var(--faint)]">
                        {r.enrollment_no}{r.admission_no ? ` · adm ${r.admission_no}` : ""}
                      </div>
                      {r.father_name && <div className="text-[12px] text-[var(--muted)]">Father: {r.father_name}</div>}
                    </td>
                    <td className="text-[var(--muted)]">{r.center_name}</td>
                    <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    <td className="whitespace-nowrap text-[var(--muted)]">{r.left_on ? fmtDate(r.left_on) : "—"}</td>
                    <td className="max-w-[260px] text-[13px]">{r.left_reason ?? "—"}</td>
                    <td>
                      <Reactivate studentId={r.id} name={r.name} centerId={r.center_id}
                        classId={r.class_id} centres={centres}
                        classes={classes.map((c) => ({ id: c.id, name: c.name }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
