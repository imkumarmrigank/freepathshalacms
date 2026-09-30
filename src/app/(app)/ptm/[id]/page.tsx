import Link from "next/link";
import { notFound } from "next/navigation";
import { canTouchCenter, requireFeature } from "@/lib/auth";
import { one } from "@/lib/db";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime, pct, titleCase } from "@/lib/format";
import {
  PRIORITY_TONE, engagementLabel, modeLabel, parentLabel, priorityLabel,
} from "@/lib/ptm-meta";
import CloseFollowUp from "./CloseFollowUp";
import { isGlobalRole } from "@/lib/roles";
import { getT } from "@/lib/i18n";

const TONE: Record<string, string> = { attentive: "ok", neutral: "warn", resistant: "bad" };

export default async function InteractionPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireFeature("ptm");
  const t = await getT();
  const { id } = await params;
  const { created } = await searchParams;

  const row = await one<{
    id: number; center_id: number; interaction_date: string; mode: string;
    parent_present: string; engagement: string; attendance_pct: string | null;
    marks_pct: string | null; discussion: string | null; concerns: string | null;
    action_items: string | null; follow_up_required: boolean; follow_up_date: string | null;
    follow_up_mode: string | null; follow_up_status: string; follow_up_notes: string | null;
    concern_tags: string[]; commitment_tags: string[]; follow_up_priority: string | null;
    follow_up_owner: string | null; confidence: number | null; support_needed: string | null;
    assignee: string | null;
    created_at: string; student_id: number; student_first: string; student_last: string | null;
    enrollment_no: string; class_name: string | null; center_name: string; mentor: string | null;
    meeting_title: string | null;
  }>(
    `SELECT i.*, s.first_name AS student_first, s.last_name AS student_last,
            s.enrollment_no, cl.name AS class_name, ce.name AS center_name,
            u.name AS mentor, m.title AS meeting_title, asg.name AS assignee
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN ptm_meetings m ON m.id = i.meeting_id
       LEFT JOIN users asg ON asg.id = i.follow_up_assignee_id
      WHERE i.id = $1`,
    [Number(id)],
  );
  if (!row) notFound();
  if (!canTouchCenter(user, row.center_id))
    return <Alert kind="bad">{t("This record belongs to another centre.")}</Alert>;

  const name = `${row.student_first} ${row.student_last ?? ""}`.trim();

  return (
    <>
      {created && <div className="mb-5"><Alert kind="ok">{t("Interaction recorded.")}</Alert></div>}

      <PageHeader
        title={name}
        subtitle={`${row.enrollment_no} · ${row.class_name ? t(row.class_name) : "—"}`
          + ` · ${row.center_name}`}
        back={{ href: "/ptm", label: t("PTM interactions") }}
        right={<Link href={`/students/${row.student_id}`} className="btn btn-ghost btn-sm">{t("Student profile")}</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-[15px] font-semibold">{t("Concerns discussed")}</h2>
            {row.concern_tags?.length ? (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {row.concern_tags.map((c) => <Badge key={c} tone="warn" dot={false}>{t(c)}</Badge>)}
              </div>
            ) : (
              <p className="mb-4 text-[13px] text-[var(--muted)]">{t("None recorded.")}</p>
            )}

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
            <h3 className="mb-2 mt-5 text-[14px] font-semibold">Commitments the parent made</h3>
            {row.commitment_tags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {row.commitment_tags.map((t) => <Badge key={t} tone="ok" dot={false}>{t}</Badge>)}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--muted)]">None recorded.</p>
            )}
            {row.action_items && (
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--muted)]">
                {row.action_items}
              </p>
            )}
            {row.support_needed && (
              <>
                <h3 className="mb-2 mt-5 text-[14px] font-semibold">{t("Support needed from the team")}</h3>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--muted)]">
                  {row.support_needed}
                </p>
              </>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">{t("Follow-up")}</h2>
              {!row.follow_up_required
                ? <Badge tone="mute">{t("Not required")}</Badge>
                : row.follow_up_status === "pending"
                  ? <Badge tone="warn">{t("Pending")}</Badge>
                  : <Badge tone={row.follow_up_status === "done" ? "ok" : "mute"}>
                      {t(titleCase(row.follow_up_status))}
                    </Badge>}
            </div>
            <p className="mt-2 text-[14px] text-[var(--muted)]">
              {row.follow_up_required
                ? t("{how} on {d}", {
                    how: t(row.follow_up_mode ? modeLabel(row.follow_up_mode) : "follow-up"),
                    d: fmtDate(row.follow_up_date) })
                : t("The mentor recorded that nothing was left outstanding after this conversation.")}
            </p>
            {row.follow_up_notes && (
              <p className="mt-3 whitespace-pre-wrap text-[14px] text-[var(--muted)]">{row.follow_up_notes}</p>
            )}
            {row.follow_up_required && (
              <CloseFollowUp id={row.id} status={row.follow_up_status} />
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 text-[15px] font-semibold">{t("Details")}</h2>
          <dl className="space-y-2.5 text-[13px]">
            {[
              [t("Date"), fmtDate(row.interaction_date)],
              [t("Mode"), t(modeLabel(row.mode))],
              [t("Who attended"), t(parentLabel(row.parent_present))],
              [t("Mentor"), row.mentor ?? "—"],
              [t("Attendance"), pct(row.attendance_pct)],
              [t("Marks"), pct(row.marks_pct)],
              [t("Follow-up owner"), row.follow_up_owner ? t(row.follow_up_owner) : "—"],
              [t("Assigned to"), row.assignee ?? row.mentor ?? "—"],
              [t("Confidence"),
                row.confidence === null ? "—" : t("{n} of 5", { n: row.confidence })],
              [t("Part of"), row.meeting_title ?? t("Ad-hoc interaction")],
              [t("Recorded"), fmtDateTime(row.created_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">{t("Engagement")}</dt>
              <dd><Badge tone={TONE[row.engagement]}>
                {t(engagementLabel(row.engagement))}
              </Badge></dd>
            </div>
            {row.follow_up_priority && (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">{t("Priority")}</dt>
                <dd>
                  <Badge tone={PRIORITY_TONE[row.follow_up_priority]}>
                    {t(priorityLabel(row.follow_up_priority))}
                  </Badge>
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </>
  );
}
