import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ROLE_LABEL, canAnswerSuggestions, type Role } from "@/lib/roles";
import {
  PRIORITY_LABEL, SUGGESTION_STATUS_LABEL, VERDICT_LABEL,
  getSuggestion, repliesFor,
} from "@/lib/audits";
import Answer from "./Answer";

export const metadata = { title: "Suggestion · Pehchaan" };

export default async function SuggestionPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await requireFeature("auditReports");
  const { id } = await params;

  const s = await getSuggestion(user, Number(id));
  if (!s) notFound();
  const replies = await repliesFor(s.id);

  // the centre it belongs to answers it; a backup teacher answers wherever they
  // are currently standing in
  const mayAnswer = canAnswerSuggestions(user.role)
    && (user.centerId === s.center_id || user.centerIds.includes(s.center_id));
  const closed = s.status === "verified" || s.status === "not_done" || s.status === "dropped";

  return (
    <>
      <PageHeader
        title={s.title}
        subtitle={`${s.center_name}${s.criterion_title ? ` · ${s.criterion_title}` : ""}`}
        right={<Link href="/audits/suggestions" className="btn btn-ghost">All suggestions</Link>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={s.priority === "critical" ? "bad"
          : s.priority === "high" ? "warn" : "mute"}>
          {PRIORITY_LABEL[s.priority]} priority
        </Badge>
        <Badge tone={s.status === "verified" ? "ok"
          : s.status === "not_done" ? "bad"
          : s.status === "done" ? "info" : "mute"}>
          {SUGGESTION_STATUS_LABEL[s.status]}
        </Badge>
        {s.overdue && <Badge tone="bad" dot={false}>Overdue</Badge>}
        <span className="text-[12.5px] text-[var(--muted)]">
          Raised {fmtDate(s.raised_on)}
          {s.raised_by_name ? ` by ${s.raised_by_name}` : ""}
          {s.due_on ? ` · due ${fmtDate(s.due_on)}` : ""}
          {s.visit_id ? (
            <> · <Link href={`/audits/${s.visit_id}`} className="text-[var(--brand)] hover:underline">
              from that visit
            </Link></>
          ) : null}
        </span>
      </div>

      {s.detail && (
        <Card className="mt-4">
          <div className="label-cap mb-1.5">What the auditor asked for</div>
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{s.detail}</p>
        </Card>
      )}

      {s.verdict && (
        <Card className="mt-4">
          <div className="label-cap mb-1.5">The auditor&rsquo;s verdict</div>
          <p className="text-[14px]">
            <strong>{VERDICT_LABEL[s.verdict]}</strong>
            {s.verified_on ? ` — ${fmtDate(s.verified_on)}` : ""}
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------ the thread */}
      <Card className="mt-4" pad={false}>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[14px] font-semibold">What the centre did about it</h2>
        </div>
        {replies.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-[var(--muted)]">
            Nobody has answered yet.
          </p>
        ) : (
          <ul>
            {replies.map((r) => (
              <li key={r.id} className="border-t border-[#f1f1f6] px-5 py-3.5 first:border-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13.5px] font-medium">{r.author_name ?? "Someone"}</span>
                  <span className="text-[12px] text-[var(--faint)]">
                    {r.author_role ? ROLE_LABEL[r.author_role as Role] ?? r.author_role : ""}
                    {" · "}{fmtDateTime(r.created_at)}
                  </span>
                  {r.set_status && (
                    <Badge tone={r.set_status === "verified" ? "ok"
                      : r.set_status === "not_done" ? "bad" : "info"}>
                      {SUGGESTION_STATUS_LABEL[r.set_status as keyof typeof SUGGESTION_STATUS_LABEL]
                        ?? r.set_status}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {closed ? (
        <p className="mt-4 text-[13px] text-[var(--muted)]">
          This one is closed. If it comes back, the auditor will raise it again at the next visit.
        </p>
      ) : (
        <Answer suggestionId={s.id} status={s.status} mayAnswer={mayAnswer} />
      )}
    </>
  );
}
