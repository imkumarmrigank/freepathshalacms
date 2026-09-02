import Link from "next/link";
import { requireFeature, effectiveTeacherIds } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import NewPlanForm from "./NewPlanForm";
import { PLAN_LEAD_DAYS } from "@/lib/plan-meta";
import { isGlobalRole, isTeaching } from "@/lib/roles";

export default async function TeachingPlansPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("teachingPlans");
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const centerId = resolveCenterId(user, sp.center);
  const params: unknown[] = [session.id];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND p.center_id = $${params.length}`; }
  if (sp.class) { params.push(Number(sp.class)); where += ` AND p.class_level_id = $${params.length}`; }
  if (isTeaching(user.role)) { params.push(user.uid); where += ` AND p.teacher_id = $${params.length}`; }
  if (sp.status) { params.push(sp.status); where += ` AND p.status = $${params.length}`; }

  const pg = pageFrom(sp);
  params.push(pg.size, pg.offset);

  const plans = await query<{
    id: number; title: string; subject: string | null; class_name: string;
    teacher: string; center_name: string; status: string; submitted_at: string | null;
    total: string; done: string; starts_on: string | null; ends_on: string | null;
    total_rows: string;
  }>(
    `SELECT count(*) OVER () AS total_rows,
            p.id, p.title, p.subject, cl.name AS class_name, u.name AS teacher,
            ce.name AS center_name, p.status, p.starts_on, p.ends_on, p.submitted_at,
            (SELECT count(*) FROM teaching_plan_topics t WHERE t.plan_id = p.id) AS total,
            (SELECT count(*) FROM teaching_plan_topics t
              WHERE t.plan_id = p.id AND t.status = 'completed') AS done
       FROM teaching_plans p
       JOIN class_levels cl ON cl.id = p.class_level_id
       JOIN users u ON u.id = p.teacher_id
       JOIN centers ce ON ce.id = p.center_id
      WHERE p.session_id = $1 ${where}
      ORDER BY cl.sequence, p.created_at DESC, p.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const totalPlans = totalOf(plans);
  const planWin = pageWindow(pg, plans.length, totalPlans);

  // A teacher can only plan for classes they hold this session.
  const myClasses = isTeaching(user.role)
    ? await query<{ id: number; name: string }>(
        `SELECT cl.id, cl.name FROM teacher_classes tc
           JOIN class_levels cl ON cl.id = tc.class_level_id
          WHERE tc.user_id = ANY($1::bigint[]) AND tc.session_id = $2 ORDER BY cl.sequence`,
        [effectiveTeacherIds(user), session.id])
    : classes;

  const teachers = !isTeaching(user.role)
    ? await query<{ id: number; name: string }>(
        `SELECT id, name FROM users WHERE role = 'teacher' AND is_active
          ${centerId ? "AND center_id = $1" : ""} ORDER BY name`,
        centerId ? [centerId] : [])
    : [];

  return (
    <>
      <PageHeader title="Teaching plans"
        subtitle={isTeaching(user.role)
          ? `Your plans for session ${session.name}`
          : `Plans across ${centerId ? user.centerName ?? "this centre" : "all centres"} · ${session.name}`} />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        extra={[{ name: "status", label: "All statuses", options: [
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
        ] }]}
      />

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card pad={false}>
            {plans.length === 0 ? (
              <Empty title="No teaching plans yet"
                hint={isTeaching(user.role) && myClasses.length === 0
                  ? "You have not been allotted a class yet. Ask your centre manager."
                  : "Create a plan, list the topics, and tick them off as you teach them."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Plan</th><th>Class</th><th>Teacher</th><th>Status</th><th>Progress</th><th>Window</th></tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => {
                      const total = Number(p.total);
                      const pct = total ? (Number(p.done) / total) * 100 : 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <Link href={`/teaching-plans/${p.id}`}
                              className="font-medium hover:text-[var(--brand)]">{p.title}</Link>
                            <div className="text-[12px] text-[var(--muted)]">{p.subject ?? "—"}</div>
                          </td>
                          <td className="text-[var(--muted)]">{p.class_name}</td>
                          <td className="text-[var(--muted)]">{p.teacher}</td>
                          <td>
                            {p.status === "draft"
                              ? <Badge tone="warn">Draft</Badge>
                              : <Badge tone="ok">Submitted</Badge>}
                          </td>
                          <td>
                            {total === 0
                              ? <Badge tone="mute">No topics</Badge>
                              : <div className="flex items-center gap-2">
                                  <Meter value={pct} />
                                  <span className="whitespace-nowrap text-[12px] text-[var(--muted)]">
                                    {p.done}/{p.total}
                                  </span>
                                </div>}
                          </td>
                          <td className="whitespace-nowrap text-[13px] text-[var(--muted)]">
                            {p.starts_on ? fmtDate(p.starts_on) : "—"}
                            {p.ends_on ? ` – ${fmtDate(p.ends_on)}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={pg.page} pages={planWin.pages} first={planWin.first}
              last={planWin.last} total={totalPlans} unit="plan" />
          </Card>
        </div>

        <NewPlanForm
          leadDays={PLAN_LEAD_DAYS}
          classes={myClasses}
          teachers={teachers}
          centers={centers}
          isTeacher={isTeaching(user.role)}
          isAdmin={isGlobalRole(user.role)}
        />
      </div>
    </>
  );
}
