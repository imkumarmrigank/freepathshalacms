import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature, canTouchCenter } from "@/lib/auth";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { canEditSyllabus, canMarkSyllabus, isTeaching } from "@/lib/roles";
import { itemsFor, progressFor, unitById } from "@/lib/syllabus";
import { MONTH_LABELS, currentPosition } from "@/lib/term-calendar";
import { currentSession } from "@/lib/queries";
import MonthWork from "./MonthWork";

export const metadata = { title: "Syllabus month · Pehchaan" };

export default async function SyllabusUnitPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ center?: string }>;
}) {
  const user = await requireFeature("syllabus");
  const { id } = await params;
  const sp = await searchParams;

  const unit = await unitById(Number(id), null);
  if (!unit) notFound();

  // an administrator may look at any centre; everyone else sees their own
  const centerId = canEditSyllabus(user.role)
    ? (Number(sp.center) || null)
    : (user.centerId ?? null);
  if (centerId && !canTouchCenter(user, centerId))
    return <Alert kind="bad">That centre is not yours.</Alert>;

  const [items, progress, session] = await Promise.all([
    itemsFor(unit.id, centerId),
    centerId ? progressFor(unit.id, centerId) : Promise.resolve(null),
    currentSession(),
  ]);

  const done = items.filter((i) => i.done_on).length;
  const mayMark = Boolean(centerId)
    && (canMarkSyllabus(user.role) || canEditSyllabus(user.role));

  // For teachers, show items grouped by week; highlight current week if viewing the active month
  const currentWeekNo = isTeaching(user.role)
    ? (() => {
        if (!session) return 0;
        const pos = currentPosition(session.start_date);
        return pos.phase === "teaching" && pos.term === unit.term_no && pos.monthNo === unit.month_no
          ? pos.weekNo
          : 0; // 0 = group by week but no week highlighted
      })()
    : undefined; // undefined = flat list (admin/manager view)

  return (
    <>
      <PageHeader
        title={`${unit.subject} — T${unit.term_no} · ${MONTH_LABELS[unit.term_no]?.[unit.month_no] ?? `Month ${unit.month_no}`}`}
        subtitle={`${unit.class_name}${unit.heading ? ` · ${unit.heading}` : ""}`}
        back={{ href: "/syllabus", label: "Syllabus" }}
        right={canEditSyllabus(user.role)
          ? <Link href="/manage/syllabus" className="btn btn-ghost">Edit the syllabus</Link>
          : null}
      />

      {unit.outcome && (
        <Card className="mt-4">
          <div className="label-cap mb-1">By the end of this month</div>
          <p className="text-[14px] leading-relaxed">{unit.outcome}</p>
        </Card>
      )}

      {!centerId ? (
        <Alert kind="info">
          Pick a centre on the syllabus page to record what it has taught. What follows is
          the syllabus itself.
        </Alert>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone={progress?.status === "completed" ? "ok"
            : progress?.status === "in_progress" ? "warn" : "mute"}>
            {progress?.status === "completed" ? "Month complete"
              : progress?.status === "in_progress" ? "Under way" : "Not started"}
          </Badge>
          <span className="text-[13px] text-[var(--muted)]">
            {done} of {items.length} lines covered
            {progress?.completed_on ? ` · finished ${fmtDate(progress.completed_on)}` : ""}
            {progress?.marked_by_name ? ` · ${progress.marked_by_name}` : ""}
          </span>
        </div>
      )}

      <MonthWork
        unitId={unit.id}
        centerId={centerId}
        items={items}
        mayMark={mayMark}
        status={progress?.status ?? "not_started"}
        remarks={progress?.remarks ?? null}
        completedOn={progress?.completed_on ?? null}
        currentWeekNo={currentWeekNo}
      />
    </>
  );
}
