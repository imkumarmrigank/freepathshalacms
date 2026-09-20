import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { can } from "@/lib/roles";
import {
  FEEDBACK_RATINGS, FEEDBACK_TEXT as T, RATING_TONE, TOPIC_LABEL, type FeedbackRow,
} from "@/lib/centre-feedback-meta";
import FeedbackForm from "./FeedbackForm";

export const metadata = { title: "Centre feedback · Pehchaan" };

export default async function CentreFeedbackPage() {
  const user = await requireUser();
  const mayWrite = can(user.role, "centreFeedback");
  const readsAll = can(user.role, "centreFeedbackReports");
  const isCentre = user.role === "center_manager";
  if (!mayWrite && !readsAll && !isCentre) redirect("/dashboard?denied=1");

  const centers = await centersForUser(user);

  // Who sees what: the office sees everything, a mentor sees what they wrote,
  // and a centre sees only the feedback the mentor chose to share with it.
  const params: unknown[] = [];
  let where = "";
  if (!readsAll) {
    if (isCentre) {
      params.push(user.centerId ?? -1);
      where = `WHERE f.share_with_centre AND f.center_id = $${params.length}`;
    } else {
      params.push(user.uid);
      where = `WHERE f.mentor_id = $${params.length}`;
    }
  }

  const rows = await query<FeedbackRow>(
    `SELECT f.id, f.center_id, c.name AS center_name, u.name AS mentor_name,
            f.visited_on, f.rating, f.topics, f.working_well, f.needs_attention,
            f.parent_voice, f.urgent, f.share_with_centre, f.language, f.created_at
       FROM centre_feedback f
       JOIN centers c ON c.id = f.center_id
       JOIN users u ON u.id = f.mentor_id
       ${where}
      ORDER BY f.visited_on DESC, f.id DESC
      LIMIT 100`,
    params,
  );

  const urgent = rows.filter((r) => r.urgent).length;
  const rated = rows.filter((r) => r.rating != null);
  const average = rated.length
    ? Math.round((rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length) * 10) / 10
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
        <StatCard label="Average rating" value={average ?? "—"} hint="out of 5" />
      </div>

      <div className={mayWrite ? "grid gap-5 lg:grid-cols-5" : ""}>
        <div className={mayWrite ? "lg:col-span-3" : ""}>
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
                      {r.rating != null && (
                        <Badge tone={RATING_TONE[r.rating]}>
                          {r.rating}/5 · {FEEDBACK_RATINGS.find((x) => x.value === r.rating)?.en}
                        </Badge>
                      )}
                    </div>
                  </div>

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

        {mayWrite && (
          <div className="lg:col-span-2">
            <FeedbackForm centers={centers} />
          </div>
        )}
      </div>
    </>
  );
}
