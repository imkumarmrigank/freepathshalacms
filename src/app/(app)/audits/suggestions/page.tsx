import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import Filters from "@/components/Filters";
import { centersForUser } from "@/lib/queries";
import { query } from "@/lib/db";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { seesAllAudits } from "@/lib/roles";
import {
  CENTRE_PRIORITY_LABEL, PRIORITY_LABEL, SUGGESTION_STATUS_LABEL, VERDICT_LABEL,
  listSuggestions, standings,
  type SuggestionRow,
} from "@/lib/audits";

export const metadata = { title: "Audit suggestions · Pehchaan" };

/**
 * Everything an auditor has asked for, and where it has got to.
 *
 * Sorted by what will bite first — overdue, then critical — rather than by date,
 * because the point of the page is to answer "what do I do next".
 */
export default async function SuggestionsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("auditReports");
  const sp = await searchParams;
  const all = seesAllAudits(user.role);

  const showClosed = sp.show === "all";
  // A centre may be asked for by an administrator; a centre's own staff are
  // held to theirs whatever the URL says.
  const centerId = all ? (sp.center ? Number(sp.center) : null) : user.centerId;
  // "who asked for this" is a question an administrator asks of the list; a
  // centre reads everything asked of it, whoever asked.
  const raisedBy = all && sp.by ? Number(sp.by) : null;
  const [rows, board, centers, auditors] = await Promise.all([
    listSuggestions(user, {
      centerId,
      open: !showClosed,
      from: sp.from ?? null,
      to: sp.to ?? null,
      raisedBy,
      limit: 200,
    }),
    standings(all ? null : user.centerId),
    centersForUser(user),
    all
      ? query<{ id: number; name: string }>(
          `SELECT DISTINCT u.id, u.name
             FROM audit_suggestions s JOIN users u ON u.id = s.raised_by
            ORDER BY u.name`)
      : Promise.resolve([]),
  ]);

  const overdue = rows.filter((r) => r.overdue).length;
  const mine = board.length === 1 ? board[0] : null;

  return (
    <>
      <PageHeader
        title="Suggestions"
        subtitle={all
          ? "What auditors have asked centres to do"
          : "What your centre has been asked to do"}
        right={
          <Link href={showClosed ? "/audits/suggestions" : "/audits/suggestions?show=all"}
            className="btn btn-ghost">
            {showClosed ? "Only outstanding" : "Include closed"}
          </Link>
        }
      />

      <div className="mt-4">
        <Filters
          centers={all ? centers : []}
          current={sp}
          dates
          extra={[
            { name: "show", label: "Only outstanding", options: [
              { value: "all", label: "Include closed" },
            ] },
            ...(auditors.length > 0
              ? [{ name: "by", label: "Raised by anyone",
                  options: auditors.map((a) => ({ value: a.id, label: a.name })) }]
              : []),
          ]}
        />
        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
          The dates are the days the suggestions were raised.
        </p>
      </div>

      {mine && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Badge tone={mine.priority === "critical" ? "bad"
              : mine.priority === "high" ? "warn"
              : mine.priority === "watch" ? "info" : "ok"}>
              {CENTRE_PRIORITY_LABEL[mine.priority]}
            </Badge>
            <span className="text-[13.5px] text-[var(--muted)]">
              {mine.open_total} outstanding
              {mine.overdue > 0 && (
                <span className="font-semibold text-[var(--bad)]"> · {mine.overdue} overdue</span>
              )}
              {mine.next_visit_on && ` · next visit ${fmtDate(mine.next_visit_on)}`}
            </span>
          </div>
        </Card>
      )}

      {overdue > 0 && !mine && (
        <p className="mt-4 rounded-[9px] bg-[var(--bad-soft)] px-3.5 py-2.5 text-[13px] text-[#b91c1c]">
          {overdue} suggestion{overdue === 1 ? " is" : "s are"} past the date the auditor set.
        </p>
      )}

      <Card className="mt-4" pad={false}>
        {rows.length === 0 ? (
          <Empty title={showClosed ? "Nothing here yet" : "Nothing outstanding"}
            hint={showClosed
              ? "Suggestions appear here after an auditor files a report."
              : "Everything an auditor asked for has been dealt with."} />
        ) : (
          <ul>{rows.map((s) => <Row key={s.id} s={s} showCentre={all} />)}</ul>
        )}
      </Card>
    </>
  );
}

function Row({ s, showCentre }: { s: SuggestionRow; showCentre: boolean }) {
  return (
    <li className="border-t border-[#f1f1f6] first:border-0">
      <Link href={`/audits/suggestions/${s.id}`}
        className="block px-5 py-4 hover:bg-[#fafafd]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium">{s.title}</span>
          <Badge tone={s.priority === "critical" ? "bad"
            : s.priority === "high" ? "warn" : "mute"}>
            {PRIORITY_LABEL[s.priority]}
          </Badge>
          <Badge tone={s.status === "verified" ? "ok"
            : s.status === "not_done" ? "bad"
            : s.status === "done" ? "info" : "mute"}>
            {SUGGESTION_STATUS_LABEL[s.status]}
          </Badge>
          {s.overdue && <Badge tone="bad" dot={false}>Overdue</Badge>}
        </div>
        <div className="mt-1 text-[12.5px] text-[var(--muted)]">
          {showCentre && <>{s.center_name} · </>}
          {s.due_on ? `due ${fmtDate(s.due_on)}` : "no date"}
          {s.criterion_title ? ` · ${s.criterion_title}` : ""}
          {s.raised_by_name ? ` · raised by ${s.raised_by_name}` : ""}
          {s.verdict ? ` · ${VERDICT_LABEL[s.verdict]}` : ""}
          {Number(s.replies) > 0
            ? ` · ${s.replies} repl${Number(s.replies) === 1 ? "y" : "ies"}`
            : " · no reply yet"}
        </div>
        {s.detail && (
          <p className="mt-1 line-clamp-2 text-[13px] text-[var(--muted)]">{s.detail}</p>
        )}
      </Link>
    </li>
  );
}
