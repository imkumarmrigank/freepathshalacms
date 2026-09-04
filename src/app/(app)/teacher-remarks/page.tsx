import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import { isGlobalRole } from "@/lib/roles";

export const metadata = { title: "Teacher remarks · Pehchaan" };

type Row = {
  id: number; plan_id: number; topic: string; status: string;
  taught_on: string | null; remarks: string | null; issues_faced: string | null;
  resources_used: string | null; subject: string | null; plan_title: string;
  class_name: string; center_name: string; teacher_name: string | null;
  total_rows: string;
};

/**
 * What teachers wrote against the topics they taught — the remark, what tripped
 * the class up, and what they reached for to fix it. The mentor reads this to
 * know which classes to sit in on.
 */
export default async function TeacherRemarksPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("teacherRemarks");
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);

  const centerId = resolveCenterId(user, sp.center);
  const params: unknown[] = [session?.id ?? 0];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND p.center_id = $${params.length}`; }
  if (sp.class) { params.push(Number(sp.class)); where += ` AND p.class_level_id = $${params.length}`; }
  if (sp.kind === "issues") where += " AND t.issues_faced IS NOT NULL AND t.issues_faced <> ''";
  if (sp.q) {
    params.push(`%${sp.q.trim()}%`);
    where += ` AND (t.remarks ILIKE $${params.length} OR t.issues_faced ILIKE $${params.length}
                    OR t.topic ILIKE $${params.length})`;
  }

  const pg = pageFrom(sp, 25);
  params.push(pg.size, pg.offset);

  const rows = await query<Row>(
    `SELECT count(*) OVER () AS total_rows,
            t.id, t.plan_id, t.topic, t.status, t.taught_on, t.remarks,
            t.issues_faced, t.resources_used,
            p.subject, p.title AS plan_title,
            cl.name AS class_name, ce.name AS center_name, u.name AS teacher_name
       FROM teaching_plan_topics t
       JOIN teaching_plans p ON p.id = t.plan_id
       JOIN class_levels cl ON cl.id = p.class_level_id
       JOIN centers ce ON ce.id = p.center_id
       LEFT JOIN users u ON u.id = COALESCE(t.taught_by, p.teacher_id)
      WHERE p.session_id = $1
        AND (COALESCE(t.remarks, '') <> '' OR COALESCE(t.issues_faced, '') <> ''
             OR COALESCE(t.resources_used, '') <> '')
        ${where}
      ORDER BY COALESCE(t.taught_on, CURRENT_DATE) DESC, t.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);

  return (
    <>
      <PageHeader title="Teacher remarks"
        subtitle={`What teachers recorded against the topics they taught${
          session ? ` · session ${session.name}` : ""}`} />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        searchPlaceholder="Search remarks, issues or topics"
        extra={[{ name: "kind", label: "All remarks", options: [
          { value: "issues", label: "Only where an issue was faced" },
        ] }]}
      />

      <Card className="mt-4" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No remarks yet"
            hint="Remarks appear here as teachers mark topics taught in their teaching plans." />
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/teaching-plans/${r.plan_id}`}
                    className="text-[14px] font-medium hover:text-[var(--brand)]">
                    {r.topic}
                  </Link>
                  {r.issues_faced && <Badge tone="warn">Issue faced</Badge>}
                  <span className="text-[12px] text-[var(--muted)]">
                    {r.subject ? `${r.subject} · ` : ""}{r.class_name} · {r.center_name}
                    {r.teacher_name ? ` · ${r.teacher_name}` : ""}
                    {r.taught_on ? ` · ${fmtDate(r.taught_on)}` : ""}
                  </span>
                </div>
                {r.remarks && <p className="mt-1.5 text-[13px]">{r.remarks}</p>}
                {r.issues_faced && (
                  <p className="mt-1 text-[13px]">
                    <span className="text-[var(--muted)]">Issue: </span>{r.issues_faced}
                  </p>
                )}
                {r.resources_used && (
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    Used: {r.resources_used}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="remark" />
      </Card>
    </>
  );
}
