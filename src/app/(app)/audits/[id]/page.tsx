import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import {
  BAND_LABEL, OVERALL_BLURB, OVERALL_LABEL, PRIORITY_LABEL,
  SUGGESTION_STATUS_LABEL, VERDICT_LABEL, VISIT_KIND_BLURB, VISIT_KIND_LABEL,
  VISIT_STATUS_LABEL,
  getVisit, listCriteria, listSuggestions, outstandingForCentre, ratingsFor,
} from "@/lib/audits";
import VisitEditor from "./VisitEditor";

export const metadata = { title: "Visit · Pehchaan" };

const BAND_TONE: Record<number, string> = {
  4: "ok", 3: "info", 2: "warn", 1: "bad", 0: "mute",
};

export default async function VisitPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await requireFeature("auditReports");
  const { id } = await params;
  const visitId = Number(id);

  const visit = await getVisit(user, visitId);
  if (!visit) notFound();

  // the auditor whose visit this is, while it is still open, gets the working
  // screen; everybody else reads the report
  const editing = user.role === "auditor"
    && visit.auditor_id === user.uid
    && visit.status !== "submitted" && visit.status !== "cancelled";

  const [ratings, suggestions, criteria, outstanding] = await Promise.all([
    ratingsFor(visitId),
    listSuggestions(user, { visitId }),
    editing ? listCriteria() : Promise.resolve([]),
    editing ? outstandingForCentre(visit.center_id) : Promise.resolve([]),
  ]);

  if (editing) {
    return (
      <VisitEditor
        visit={visit}
        criteria={criteria}
        ratings={ratings}
        suggestions={suggestions}
        outstanding={outstanding.filter((s) => s.visit_id !== visitId)}
      />
    );
  }

  const present = visit.children_present;
  const roll = visit.children_on_roll;

  return (
    <>
      <PageHeader
        title={visit.center_name}
        subtitle={`${VISIT_KIND_LABEL[visit.kind]} · ${
          visit.visited_on ? fmtDate(visit.visited_on)
            : visit.scheduled_for ? `due ${fmtDate(visit.scheduled_for)}` : "no date"
        }${visit.auditor_name ? ` · ${visit.auditor_name}` : ""}`}
        right={<Link href="/audits" className="btn btn-ghost">All visits</Link>}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={visit.status === "submitted" ? "ok" : "info"}>
          {VISIT_STATUS_LABEL[visit.status]}
        </Badge>
        {visit.overall && (
          <Badge tone={visit.overall === "healthy" ? "ok"
            : visit.overall === "attention" ? "info"
            : visit.overall === "support" ? "warn" : "bad"}>
            {OVERALL_LABEL[visit.overall]}
          </Badge>
        )}
        {visit.score_pct != null && (
          <span className="text-[13px] tabular-nums text-[var(--muted)]">
            Score {Number(visit.score_pct).toFixed(1)}%
          </span>
        )}
      </div>

      {visit.status !== "submitted" && (
        <p className="mt-3 rounded-[9px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-[13px]">
          This report has not been filed yet, so the ratings below may still change.
        </p>
      )}

      {/* ---------------------------------------------------- the snapshot */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="label-cap mb-1">Children present</div>
          <div className="text-[22px] font-semibold tabular-nums">
            {present ?? "—"}{roll ? <span className="text-[15px] font-normal text-[var(--muted)]"> / {roll}</span> : null}
          </div>
          {present != null && roll ? (
            <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">
              {Math.round((present / roll) * 100)}% of the roll
            </div>
          ) : null}
        </Card>
        <Card>
          <div className="label-cap mb-1">Staff present</div>
          <div className="text-[22px] font-semibold tabular-nums">
            {visit.staff_present ?? "—"}
            {visit.staff_on_roll ? (
              <span className="text-[15px] font-normal text-[var(--muted)]"> / {visit.staff_on_roll}</span>
            ) : null}
          </div>
        </Card>
        <Card>
          <div className="label-cap mb-1">Overall</div>
          <div className="text-[16px] font-semibold">
            {visit.overall ? OVERALL_LABEL[visit.overall] : "Not set"}
          </div>
          {visit.overall && (
            <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">
              {OVERALL_BLURB[visit.overall]}
            </div>
          )}
        </Card>
        <Card>
          <div className="label-cap mb-1">Kind of visit</div>
          <div className="text-[16px] font-semibold">{VISIT_KIND_LABEL[visit.kind]}</div>
          <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            {VISIT_KIND_BLURB[visit.kind]}
          </div>
        </Card>
      </div>

      {visit.summary && (
        <Card className="mt-5">
          <div className="label-cap mb-1.5">What the auditor wrote</div>
          <p className="whitespace-pre-line text-[14px] leading-relaxed">{visit.summary}</p>
        </Card>
      )}

      {/* ----------------------------------------------------- the ratings */}
      {ratings.length > 0 && (
        <Card className="mt-5" pad={false}>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h2 className="text-[14px] font-semibold">What was checked</h2>
          </div>
          <ul>
            {ratings.map((r) => (
              <li key={r.id} className="border-t border-[#f1f1f6] px-5 py-3 first:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-cap text-[var(--faint)]">{r.section}</span>
                  <span className="text-[14px] font-medium">{r.criterion_title}</span>
                  <Badge tone={BAND_TONE[r.band]}>{BAND_LABEL[r.band]}</Badge>
                </div>
                {r.reason && (
                  <p className="mt-1 text-[13px] text-[var(--muted)]">Reason: {r.reason}</p>
                )}
                {r.note && <p className="mt-1 text-[13px]">{r.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------- the suggestions */}
      <Card className="mt-5" pad={false}>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 className="text-[14px] font-semibold">What the centre was asked to do</h2>
          <p className="text-[12.5px] text-[var(--muted)]">
            Each of these is expected to be done before the next visit.
          </p>
        </div>
        {suggestions.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-[var(--muted)]">
            Nothing was raised at this visit.
          </p>
        ) : (
          <ul>
            {suggestions.map((s) => (
              <li key={s.id} className="border-t border-[#f1f1f6] first:border-0">
                <Link href={`/audits/suggestions/${s.id}`}
                  className="block px-5 py-3.5 hover:bg-[#fafafd]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{s.title}</span>
                    <Badge tone={s.priority === "critical" ? "bad"
                      : s.priority === "high" ? "warn" : "mute"}>
                      {PRIORITY_LABEL[s.priority]}
                    </Badge>
                    <Badge tone={s.status === "verified" ? "ok"
                      : s.status === "not_done" ? "bad"
                      : s.overdue ? "bad" : "info"}>
                      {SUGGESTION_STATUS_LABEL[s.status]}
                    </Badge>
                    {s.overdue && <Badge tone="bad" dot={false}>Overdue</Badge>}
                  </div>
                  <div className="mt-1 text-[12.5px] text-[var(--muted)]">
                    {s.due_on ? `Due ${fmtDate(s.due_on)}` : "No date set"}
                    {s.verdict ? ` · ${VERDICT_LABEL[s.verdict]}` : ""}
                    {Number(s.replies) > 0 ? ` · ${s.replies} repl${Number(s.replies) === 1 ? "y" : "ies"}` : ""}
                  </div>
                  {s.detail && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-[var(--muted)]">{s.detail}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
