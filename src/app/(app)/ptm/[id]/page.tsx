import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime, pct, titleCase } from "@/lib/format";
import CloseFollowUp from "./CloseFollowUp";

const TONE: Record<string, string> = { attentive: "ok", neutral: "warn", resistant: "bad" };

export default async function InteractionPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { created } = await searchParams;

  const row = await one<{
    id: number; center_id: number; interaction_date: string; mode: string;
    parent_present: string; engagement: string; attendance_pct: string | null;
    marks_pct: string | null; discussion: string | null; concerns: string | null;
    action_items: string | null; follow_up_required: boolean; follow_up_date: string | null;
    follow_up_mode: string | null; follow_up_status: string; follow_up_notes: string | null;
    created_at: string; student_id: number; student_first: string; student_last: string | null;
    enrollment_no: string; class_name: string | null; center_name: string; mentor: string | null;
    meeting_title: string | null;
  }>(
    `SELECT i.*, s.first_name AS student_first, s.last_name AS student_last,
            s.enrollment_no, cl.name AS class_name, ce.name AS center_name,
            u.name AS mentor, m.title AS meeting_title
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN ptm_meetings m ON m.id = i.meeting_id
      WHERE i.id = $1`,
    [Number(id)],
  );
  if (!row) notFound();
  if (user.role !== "super_admin" && row.center_id !== user.centerId)
    return <Alert kind="bad">This record belongs to another centre.</Alert>;

  const name = `${row.student_first} ${row.student_last ?? ""}`.trim();

  return (
    <>
      {created && <div className="mb-5"><Alert kind="ok">Interaction recorded.</Alert></div>}

      <PageHeader
        title={name}
        subtitle={`${row.enrollment_no} · ${row.class_name ?? "—"} · ${row.center_name}`}
        back={{ href: "/ptm", label: "PTM interactions" }}
        right={<Link href={`/students/${row.student_id}`} className="btn btn-ghost btn-sm">Student profile</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">Discussion</h2>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--muted)]">
              {row.discussion || "No notes were recorded."}
            </p>
            {row.concerns && (
              <>
                <h3 className="mb-2 mt-5 text-[14px] font-semibold">Concerns raised</h3>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--muted)]">{row.concerns}</p>
              </>
            )}
            {row.action_items && (
              <>
                <h3 className="mb-2 mt-5 text-[14px] font-semibold">Action items</h3>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--muted)]">{row.action_items}</p>
              </>
            )}
          </Card>

          {row.follow_up_required && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold">Follow-up</h2>
                {row.follow_up_status === "pending"
                  ? <Badge tone="warn">Pending</Badge>
                  : <Badge tone={row.follow_up_status === "done" ? "ok" : "mute"}>{titleCase(row.follow_up_status)}</Badge>}
              </div>
              <p className="mt-2 text-[14px] text-[var(--muted)]">
                {titleCase(row.follow_up_mode ?? "follow-up")} on {fmtDate(row.follow_up_date)}
              </p>
              {row.follow_up_notes && (
                <p className="mt-3 whitespace-pre-wrap text-[14px] text-[var(--muted)]">{row.follow_up_notes}</p>
              )}
              {row.follow_up_status === "pending" && <CloseFollowUp id={row.id} />}
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold">Details</h2>
          <dl className="space-y-2.5 text-[13px]">
            {[
              ["Date", fmtDate(row.interaction_date)],
              ["Mode", titleCase(row.mode)],
              ["Who attended", titleCase(row.parent_present)],
              ["Mentor", row.mentor ?? "—"],
              ["Attendance", pct(row.attendance_pct)],
              ["Marks", pct(row.marks_pct)],
              ["Part of", row.meeting_title ?? "Ad-hoc interaction"],
              ["Recorded", fmtDateTime(row.created_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Engagement</dt>
              <dd><Badge tone={TONE[row.engagement]}>{titleCase(row.engagement)}</Badge></dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
