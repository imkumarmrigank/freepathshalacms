import { notFound } from "next/navigation";
import { requireUser, canTouchCenter } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { Alert, Badge, Card, Empty, Meter, PageHeader, StatCard } from "@/components/ui";
import { fmtDate, fmtDateTime, titleCase } from "@/lib/format";
import TopicRow, { type Topic } from "./TopicRow";
import AddTopic from "./AddTopic";
import SubmitPlan from "./SubmitPlan";
import { PLAN_LEAD_DAYS } from "@/lib/plan-meta";
import { isGlobalRole } from "@/lib/roles";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const planId = Number(id);

  const plan = await one<{
    id: number; title: string; subject: string | null; description: string | null;
    center_id: number; teacher_id: number; class_name: string; teacher: string;
    center_name: string; session_name: string; starts_on: string | null;
    ends_on: string | null; status: string; submitted_at: string | null;
    submitted_by_name: string | null;
  }>(
    `SELECT p.id, p.title, p.subject, p.description, p.center_id, p.teacher_id,
            cl.name AS class_name, u.name AS teacher, ce.name AS center_name,
            s.name AS session_name, p.starts_on, p.ends_on, p.status,
            p.submitted_at, sb.name AS submitted_by_name
       FROM teaching_plans p
       LEFT JOIN users sb ON sb.id = p.submitted_by
       JOIN class_levels cl ON cl.id = p.class_level_id
       JOIN users u ON u.id = p.teacher_id
       JOIN centers ce ON ce.id = p.center_id
       JOIN academic_sessions s ON s.id = p.session_id
      WHERE p.id = $1`,
    [planId],
  );
  if (!plan) notFound();
  if (!canTouchCenter(user, plan.center_id))
    return <Alert kind="bad">This plan belongs to another centre.</Alert>;

  const canEdit =
    isGlobalRole(user.role) ||
    (user.role === "center_manager" && plan.center_id === user.centerId) ||
    (user.role === "teacher" && plan.teacher_id === user.uid);

  const topics = await query<Topic>(
    `SELECT t.id, t.sequence, t.topic, t.objective, t.planned_date, t.status,
            t.taught_on, t.remarks, t.resources_used, t.issues_faced,
            u.name AS taught_by_name
       FROM teaching_plan_topics t
       LEFT JOIN users u ON u.id = t.taught_by
      WHERE t.plan_id = $1 ORDER BY t.sequence`,
    [planId],
  );

  const done = topics.filter((t) => t.status === "completed").length;
  const pct = topics.length ? (done / topics.length) * 100 : 0;
  const withIssues = topics.filter((t) => t.issues_faced).length;

  return (
    <>
      <PageHeader
        title={plan.title}
        subtitle={`${plan.class_name} · ${plan.subject ?? "No subject"} · ${plan.teacher} · ${plan.center_name} · ${plan.session_name}`}
        back={{ href: "/teaching-plans", label: "Teaching plans" }}
        right={
          plan.status === "draft"
            ? <Badge tone="warn">Draft — not submitted</Badge>
            : <Badge tone="ok">
                Submitted{plan.submitted_at ? ` ${fmtDateTime(plan.submitted_at)}` : ""}
              </Badge>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <StatCard label="Topics" value={topics.length} hint="in this plan" />
        <StatCard label="Taught" value={done} hint={`${Math.round(pct)}% covered`} tone="ok" />
        <StatCard label="Remaining" value={topics.length - done} hint="still to cover" />
        <StatCard label="Issues logged" value={withIssues} hint="topics with problems noted"
          tone={withIssues ? "warn" : "default"} />
      </div>

      {plan.description && (
        <div className="mb-5"><Alert kind="info">{plan.description}</Alert></div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card pad={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-[15px] font-semibold">Topics</h2>
              <div className="flex items-center gap-3">
                {(plan.starts_on || plan.ends_on) && (
                  <span className="text-[13px] text-[var(--muted)]">
                    {plan.starts_on ? fmtDate(plan.starts_on) : "—"}
                    {plan.ends_on ? ` – ${fmtDate(plan.ends_on)}` : ""}
                  </span>
                )}
                {topics.length > 0 && <Meter value={pct} />}
              </div>
            </div>
            {topics.length === 0 ? (
              <Empty title="No topics yet"
                hint={canEdit
                  ? "List what you plan to teach, then tick each one off as you cover it."
                  : "The teacher has not added topics yet."} />
            ) : (
              <ul>
                {topics.map((t) => <TopicRow key={t.id} t={t} canEdit={canEdit} />)}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          {canEdit && plan.status === "draft" && (
            <SubmitPlan planId={plan.id} topics={topics.length}
              startsOn={plan.starts_on} leadDays={PLAN_LEAD_DAYS} />
          )}
          {plan.status !== "draft" && plan.submitted_by_name && (
            <Card>
              <h2 className="mb-1 text-[15px] font-semibold">Submitted</h2>
              <p className="text-[13px] text-[var(--muted)]">
                Sent by {plan.submitted_by_name} on {fmtDateTime(plan.submitted_at)}. Your centre
                manager and the administrator can read this plan.
              </p>
            </Card>
          )}
          {canEdit && <AddTopic planId={plan.id} />}
        </div>
      </div>
    </>
  );
}
