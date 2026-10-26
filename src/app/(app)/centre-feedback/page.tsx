import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { can } from "@/lib/roles";
import {
  ASSESSMENT_PARAMS, BAND_LABEL, BAND_TONE, FEEDBACK_RATINGS, FEEDBACK_TEXT as T,
  RATING_TONE, SCORE_OPTIONS, TOPIC_LABEL, consolidate, type FeedbackRow,
} from "@/lib/centre-feedback-meta";
import FeedbackForm from "./FeedbackForm";

export const metadata = { title: "Centre feedback · Pehchaan" };

export default async function CentreFeedbackPage({
  searchParams,
}: { searchParams: Promise<{ done?: string; draft?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const mayWrite = can(user.role, "centreFeedback");
  const readsAll = can(user.role, "centreFeedbackReports");
  const isCentre = user.role === "center_manager";
  if (!mayWrite && !readsAll && !isCentre) redirect("/dashboard?denied=1");

  const centers = await centersForUser(user);

  // Who sees what: the office sees everything, a mentor sees what they wrote,
  // and a centre sees only the feedback the mentor chose to share with it.
  const params: unknown[] = [];
  // drafts belong to the mentor who started them and nobody else
  let where = "WHERE f.status = 'submitted'";
  if (!readsAll) {
    if (isCentre) {
      params.push(user.centerId ?? -1);
      where = `WHERE f.status = 'submitted' AND f.share_with_centre AND f.center_id = $${params.length}`;
    } else {
      params.push(user.uid);
      where = `WHERE f.mentor_id = $${params.length}`;
    }
  }

  const rows = await query<FeedbackRow>(
    `SELECT f.id, f.center_id, c.name AS center_name, u.name AS mentor_name,
            f.visited_on, f.rating, f.topics, f.working_well, f.needs_attention,
            f.parent_voice, f.urgent, f.share_with_centre, f.language, f.created_at,
            f.status, f.ratings, f.overall_score
       FROM centre_feedback f
       JOIN centers c ON c.id = f.center_id
       JOIN users u ON u.id = f.mentor_id
       ${where}
      ORDER BY f.visited_on DESC, f.id DESC
      LIMIT 100`,
    params,
  );

  if (mayWrite && !readsAll) {
    const draftRow = sp.draft ? rows.find((r) => r.id === Number(sp.draft) && r.status === "draft") : undefined;
    const previous = (
      <details className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
        <summary className="cursor-pointer text-[13px]">
          <span className="font-semibold">Previous Feedback</span>{" "}
          <span className="text-[var(--muted)]">| पिछला फ़ीडबैक ({rows.length})</span>
        </summary>
        {rows.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--muted)]">{T.none.en} / {T.none.hi}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {rows.map((r) => {
              const c = consolidate(r.ratings ?? {});
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                  <div>
                    <div className="font-medium">{r.center_name}</div>
                    <div className="text-[12px] text-[var(--muted)]">{fmtDate(r.visited_on)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "draft" ? (
                      <>
                        <Badge tone="warn">Draft</Badge>
                        <Link href={`/centre-feedback?draft=${r.id}`}
                          className="text-[12px] text-[var(--brand)] hover:underline">Continue</Link>
                      </>
                    ) : r.overall_score !== null ? (
                      <Badge tone={BAND_TONE[c.band]}>
                        {Number(r.overall_score).toFixed(2)}/3 · {BAND_LABEL[c.band].en}
                      </Badge>
                    ) : r.rating != null ? (
                      <Badge tone={RATING_TONE[r.rating]}>{r.rating}/5</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    );
    return (
      <>
        {sp.done && (
          <div className="mx-auto mb-4 max-w-[640px] rounded-[9px] bg-[var(--ok-soft)] px-3.5 py-2.5 text-[13px] text-[#15803d]">
            {sp.done === "draft"
              ? "Draft saved. / ड्राफ़्ट सहेज लिया गया।"
              : "Feedback submitted. / फ़ीडबैक जमा हो गया।"}
          </div>
        )}
        <FeedbackForm key={draftRow?.id ?? "new"} centers={centers} mentorName={user.name}
          previous={previous}
          draft={draftRow ? {
            id: draftRow.id, centerId: draftRow.center_id,
            visitedOn: String(draftRow.visited_on).slice(0, 10), ratings: draftRow.ratings ?? {},
            workingWell: draftRow.working_well ?? "", needsAttention: draftRow.needs_attention ?? "",
            parentVoice: draftRow.parent_voice ?? "",
          } : null} />
      </>
    );
  }

  const urgent = rows.filter((r) => r.urgent).length;
  const scored = rows.filter((r) => r.overall_score !== null);
  const average = scored.length
    ? Math.round((scored.reduce((n, r) => n + Number(r.overall_score), 0) / scored.length) * 100) / 100
    : null;

  return (
    <>
      <PageHeader title={`${T.title.en} / ${T.title.hi}`}
        subtitle={readsAll
          ? "What the mentors are seeing at the centres"
          : isCentre
            ? "Feedback the mentor has shared with your centre / मेंटर ने आपके केंद्र को भेजा फ़ीडबैक"
            : "Your feedback on the centres you work with / आपका केंद्र फ़ीडबैक"} />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Feedback recorded" value={rows.length}
          hint={readsAll ? "across every centre" : "by you"} />
        <StatCard label="Needs the office" value={urgent}
          hint={urgent ? "marked urgent" : "nothing urgent"}
          tone={urgent ? "bad" : "default"} />
        <StatCard label="Average rating" value={average ?? "—"} hint="out of 3" />
      </div>

      <div>
        <div>
          <div className="label-cap mb-2.5">{T.history.en} / {T.history.hi}</div>
          {rows.length === 0 ? (
            <Card pad={false}>
              <Empty title={`${T.none.en} / ${T.none.hi}`}
                hint={mayWrite
                  ? "Feedback you give on a centre is listed here."
                  : "Nothing has been shared yet."} />
            </Card>
          ) : (
            <div className="grid gap-4">
              {rows.map((r) => (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-semibold">{r.center_name}</div>
                      <div className="text-[12px] text-[var(--muted)]">
                        {fmtDate(r.visited_on)}
                        {(readsAll || isCentre) && ` · ${r.mentor_name}`}
                        {r.language === "hi" && " · हिन्दी"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.urgent && <Badge tone="bad">Urgent / ज़रूरी</Badge>}
                      {!r.share_with_centre && <Badge tone="mute">Office only</Badge>}
                      {r.overall_score !== null && (
                        <Badge tone={BAND_TONE[consolidate(r.ratings ?? {}).band]}>
                          {Number(r.overall_score).toFixed(2)}/3 · {BAND_LABEL[consolidate(r.ratings ?? {}).band].en}
                        </Badge>
                      )}
                      {r.rating != null && (
                        <Badge tone={RATING_TONE[r.rating]}>
                          {r.rating}/5 · {FEEDBACK_RATINGS.find((x) => x.value === r.rating)?.en}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {r.overall_score !== null && (
                    <div className="mt-2.5 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                      {ASSESSMENT_PARAMS.map((p) => {
                        const v = r.ratings?.[p.key];
                        return (
                          <div key={p.key} className="flex justify-between gap-2">
                            <span className="text-[var(--muted)]">{p.en}</span>
                            <span>{v ? SCORE_OPTIONS.find((o) => o.value === v)?.en : "Not observed"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {r.topics.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {r.topics.map((t) => (
                        <span key={t}
                          className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                          {TOPIC_LABEL[t]?.en ?? t} / {TOPIC_LABEL[t]?.hi ?? ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {[
                    [T.workingWell, r.working_well],
                    [T.needsWork, r.needs_attention],
                    [T.parentVoice, r.parent_voice],
                  ].map(([label, value], i) => value ? (
                    <div key={i} className="mt-3">
                      <div className="label-cap">
                        {(label as { en: string }).en} / {(label as { hi: string }).hi}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed">
                        {value as string}
                      </p>
                    </div>
                  ) : null)}
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
