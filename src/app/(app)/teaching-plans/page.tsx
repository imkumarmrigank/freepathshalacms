import Link from "next/link";
import { requireFeature, effectiveTeacherIds } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import { isGlobalRole, isTeaching } from "@/lib/roles";
import { itemsFor, progressFor } from "@/lib/syllabus";
import MonthWork from "@/app/(app)/syllabus/[id]/MonthWork";

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
       JOIN users u ON u.id = p.teacher_id AND NOT u.is_test
       JOIN centers ce ON ce.id = p.center_id
      WHERE p.session_id = $1 ${where}
      ORDER BY cl.sequence, p.created_at DESC, p.id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const totalPlans = totalOf(plans);
  const planWin = pageWindow(pg, plans.length, totalPlans);

  // For teachers: find the first non-completed month per (class × subject) at their centre.
  type ActiveUnit = {
    id: number; subject: string; month_no: number; heading: string | null;
    class_name: string; class_level_id: number; status: string;
  };
  let syllabusSection: { unit: ActiveUnit; items: Awaited<ReturnType<typeof itemsFor>>; progress: Awaited<ReturnType<typeof progressFor>> }[] = [];

  if (isTeaching(user.role) && user.centerId) {
    const teacherClassIds = await query<{ id: number }>(
      `SELECT DISTINCT cl.id FROM teacher_classes tc
         JOIN class_levels cl ON cl.id = tc.class_level_id
        WHERE tc.user_id = ANY($1::bigint[]) AND tc.session_id = $2`,
      [effectiveTeacherIds(user), session.id],
    );
    const classIds = teacherClassIds.map((r) => r.id);

    if (classIds.length > 0) {
      const activeUnits = await query<ActiveUnit>(`
        SELECT DISTINCT ON (u.class_level_id, u.subject)
          u.id, u.subject, u.month_no, u.heading,
          cl.name AS class_name, u.class_level_id,
          COALESCE(p.status, 'not_started') AS status
        FROM syllabus_units u
        JOIN class_levels cl ON cl.id = u.class_level_id
        LEFT JOIN syllabus_progress p ON p.unit_id = u.id AND p.center_id = $1
        WHERE u.session_id = $2 AND u.class_level_id = ANY($3::int[])
          AND COALESCE(p.status, 'not_started') <> 'completed'
        ORDER BY u.class_level_id, u.subject, u.month_no
      `, [user.centerId, session.id, classIds]);

      syllabusSection = await Promise.all(
        activeUnits.map(async (u) => ({
          unit: u,
          items: await itemsFor(u.id, user.centerId!),
          progress: await progressFor(u.id, user.centerId!),
        })),
      );
    }
  }

  return (
    <>
      <PageHeader title="Teaching plans"
        subtitle={isTeaching(user.role)
          ? `Your plans for session ${session.name}`
          : `Plans across ${centerId ? user.centerName ?? "this centre" : "all centres"} · ${session.name}`} />

      {/* ── current syllabus for teachers ── */}
      {syllabusSection.length > 0 && (
        <section className="mt-4 space-y-5">
          <h2 className="text-[15px] font-semibold">Current syllabus</h2>
          {syllabusSection.map(({ unit, items, progress }) => (
            <div key={unit.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--brand)]">
                  Month {unit.month_no}
                </span>
                <span className="text-[14px] font-medium">{unit.subject}</span>
                <span className="text-[13px] text-[var(--muted)]">{unit.class_name}</span>
                {unit.heading && (
                  <span className="text-[12.5px] text-[var(--muted)]">· {unit.heading}</span>
                )}
                <Link href={`/syllabus/${unit.id}?center=${user.centerId}`}
                  className="ml-auto text-[12px] text-[var(--brand)] underline-offset-2 hover:underline">
                  Full month view
                </Link>
              </div>
              {items.length === 0 ? (
                <Card><p className="text-[13px] text-[var(--muted)]">No items added for this month yet.</p></Card>
              ) : (
                <MonthWork
                  unitId={unit.id}
                  centerId={user.centerId!}
                  items={items}
                  mayMark={true}
                  status={progress?.status ?? "not_started"}
                  remarks={progress?.remarks ?? null}
                  completedOn={progress?.completed_on ?? null}
                />
              )}
            </div>
          ))}
        </section>
      )}

      {isTeaching(user.role) && syllabusSection.length === 0 && user.centerId && (
        <div className="mt-4">
          <Alert kind="info">
            No syllabus has been set for your class yet. The administrator will add it shortly.
          </Alert>
        </div>
      )}

      {/* ── teaching plans list ── */}
      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        extra={[{ name: "status", label: "All statuses", options: [
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
        ] }]}
      />

      <Card className="mt-4" pad={false}>
        {plans.length === 0 ? (
          <Empty title="No teaching plans yet"
            hint="Teaching plans are filled in by teachers separately from the syllabus." />
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
    </>
  );
}
