import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, listClasses, resolveCenterId } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import SiblingMark from "@/components/SiblingMark";
import { SIBLING_COLS, SIBLING_JOIN } from "@/lib/siblings";
import Pager from "@/components/Pager";
import SortHeader, { sortFrom } from "@/components/SortHeader";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import {
  ACTION_LABEL, FLAG_REASONS, FLAG_STATUS_LABEL, FLAG_STATUS_TONE,
} from "@/lib/counselling-meta";
import { isGlobalRole, ROLE_LABEL, type Role } from "@/lib/roles";

export const metadata = { title: "Flagged students · Pehchaan" };

type Step = { kind: string; note: string | null; on: string; by: string | null };

type Row = {
  id: number; student_id: number; first_name: string; last_name: string | null;
  enrollment_no: string; center_name: string; class_name: string | null;
  reasons: string[]; note: string | null; urgency: string; status: string;
  raised_on: string; raised_by_name: string | null; raised_by_role: string | null;
  mentor_name: string | null; picked_up_on: string | null;
  outcome: string | null; closed_on: string | null; days_open: string;
  steps: number; trail: Step[] | null;
  times_flagged: number; nth: number;
  sibling_count: number; sibling_names: string | null; total_rows: string;
};

const TIMES_FLAGGED =
  "(SELECT count(*) FROM counselling_flags f2 WHERE f2.student_id = f.student_id)";

/** 1st, 2nd, 3rd — for "this is the 3rd referral". */
function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] ?? ["th", "st", "nd", "rd"][n % 100] ?? "th";
  return `${n}${s}`;
}

const SORT = ["flagged", "student", "class", "centre", "status", "waiting", "action",
  "times"] as const;
const ORDER: Record<(typeof SORT)[number], string> = {
  flagged: "f.raised_on",
  student: "s.first_name",
  class: "cl.sequence",
  centre: "ce.code",
  status: "array_position(ARRAY['open','in_progress','closed'], f.status)",
  waiting: "COALESCE(f.closed_on, CURRENT_DATE) - f.raised_on",
  action: "a.last_on",
  times: TIMES_FLAGGED,
};

export default async function FlaggedStudentsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("counselling");
  const sp = await searchParams;
  const [centers, classes] = await Promise.all([centersForUser(user), listClasses()]);

  const centerId = resolveCenterId(user, sp.center);
  const params: unknown[] = [];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND f.center_id = $${params.length}`; }
  if (sp.class) { params.push(Number(sp.class)); where += ` AND f.class_level_id = $${params.length}`; }
  if (sp.status === "pending") where += " AND f.status <> 'closed'";
  else if (sp.status) { params.push(sp.status); where += ` AND f.status = $${params.length}`; }
  if (sp.urgency) { params.push(sp.urgency); where += ` AND f.urgency = $${params.length}`; }
  if (sp.reason && (FLAG_REASONS as readonly string[]).includes(sp.reason)) {
    params.push(sp.reason); where += ` AND $${params.length} = ANY (f.reasons)`;
  }
  if (sp.by) { params.push(Number(sp.by)); where += ` AND f.raised_by = $${params.length}`; }
  if (sp.mentor) { params.push(Number(sp.mentor)); where += ` AND f.mentor_id = $${params.length}`; }
  // A child the teachers keep coming back about is the one to look at first
  if (sp.repeat === "1") where += ` AND ${TIMES_FLAGGED} > 1`;
  // The period is read against the day the teacher flagged the child, which is
  // the date an administrator has in mind when they ask for "last month".
  if (sp.from) { params.push(sp.from); where += ` AND f.raised_on >= $${params.length}`; }
  if (sp.to) { params.push(sp.to); where += ` AND f.raised_on <= $${params.length}`; }

  const { sort, dir } = sortFrom(sp, SORT);
  const d = dir === "desc" ? "DESC" : "ASC";
  const orderBy = sort
    // within a tie — a child's own three referrals, say — newest first
    ? `${ORDER[sort]} ${d} NULLS LAST, f.raised_on DESC, f.id DESC`
    : "(f.status <> 'closed') DESC, (f.urgency = 'high') DESC, f.raised_on DESC, f.id DESC";

  const pg = pageFrom(sp, 25);
  const listParams = [...params, pg.size, pg.offset];

  // The trail is fetched with the row rather than in a second pass: a mentor's
  // steps are the point of this page, and a lateral join keeps it to one query.
  const trail = `LEFT JOIN LATERAL (
        SELECT count(*)::int AS steps, max(x.acted_on) AS last_on,
               json_agg(json_build_object(
                 'kind', x.kind, 'note', x.note,
                 'on', to_char(x.acted_on, 'YYYY-MM-DD'), 'by', u.name)
                 ORDER BY x.acted_on DESC, x.id DESC) AS trail
          FROM counselling_actions x
          LEFT JOIN users u ON u.id = x.acted_by
         WHERE x.flag_id = f.id) a ON TRUE`;

  const [rows, tallyRows] = await Promise.all([
    query<Row>(
      `SELECT count(*) OVER () AS total_rows,
              f.id, f.student_id, s.first_name, s.last_name, s.enrollment_no,
              ce.name AS center_name, cl.name AS class_name,
              f.reasons, f.note, f.urgency, f.status, f.raised_on, f.picked_up_on,
              f.outcome, f.closed_on,
              r.name AS raised_by_name, r.role AS raised_by_role, m.name AS mentor_name,
              COALESCE(f.closed_on, CURRENT_DATE) - f.raised_on AS days_open,
              COALESCE(a.steps, 0) AS steps, a.trail, ${SIBLING_COLS},
              ${TIMES_FLAGGED}::int AS times_flagged,
              -- which referral this is, counting from the first
              (SELECT count(*) FROM counselling_flags f2
                WHERE f2.student_id = f.student_id
                  AND (f2.raised_on, f2.id) <= (f.raised_on, f.id))::int AS nth
         FROM counselling_flags f
         JOIN students s ON s.id = f.student_id
         JOIN centers ce ON ce.id = f.center_id
         LEFT JOIN class_levels cl ON cl.id = f.class_level_id
         LEFT JOIN users r ON r.id = f.raised_by
         LEFT JOIN users m ON m.id = f.mentor_id
         ${trail}
         ${SIBLING_JOIN}
        WHERE 1=1 ${where}
        ORDER BY ${orderBy}
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    ),
    query<{ open: string; working: string; closed: string; urgent: string;
            untouched: string; repeats: string }>(
      `SELECT count(*) FILTER (WHERE f.status = 'open')               AS open,
              count(*) FILTER (WHERE f.status = 'in_progress')        AS working,
              count(*) FILTER (WHERE f.status = 'closed')             AS closed,
              count(*) FILTER (WHERE f.status <> 'closed'
                                 AND f.urgency = 'high')              AS urgent,
              count(*) FILTER (WHERE f.status = 'open'
                                 AND CURRENT_DATE - f.raised_on > 7)  AS untouched,
              count(DISTINCT f.student_id)
                FILTER (WHERE ${TIMES_FLAGGED} > 1)                   AS repeats
         FROM counselling_flags f
        WHERE 1=1 ${where}`,
      params,
    ),
  ]);

  const tally = tallyRows[0];
  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);
  const sortProps = { sort, dir, sp, basePath: "/counselling/flagged" };

  // Only the people who have actually raised or worked a referral are offered,
  // so the two pickers stay short and never list a name with nothing behind it.
  const [raisers, mentors] = await Promise.all([
    query<{ id: number; name: string; role: string }>(
      `SELECT DISTINCT u.id, u.name, u.role FROM users u
         JOIN counselling_flags f ON f.raised_by = u.id ORDER BY u.name`),
    query<{ id: number; name: string; role: string }>(
      `SELECT DISTINCT u.id, u.name, u.role FROM users u
         JOIN counselling_flags f ON f.mentor_id = u.id ORDER BY u.name`),
  ]);

  return (
    <>
      <PageHeader title="Flagged students"
        subtitle="Every child a teacher has flagged, when it was flagged and what the mentor did about it"
        right={<Link href="/counselling" className="btn">Mentor&apos;s list</Link>} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Flagged" value={total} hint="matching these filters" />
        <StatCard label="Awaiting mentor" value={Number(tally?.open ?? 0)}
          tone={Number(tally?.open ?? 0) > 0 ? "warn" : "default"} />
        <StatCard label="Counselling under way" value={Number(tally?.working ?? 0)} />
        <StatCard label="Closed" value={Number(tally?.closed ?? 0)} tone="ok" />
        <StatCard label="Urgent, still open" value={Number(tally?.urgent ?? 0)}
          hint={`${Number(tally?.untouched ?? 0)} untouched over a week`}
          tone={Number(tally?.urgent ?? 0) > 0 ? "bad" : "default"} />
        {/* one referral is a moment; three is a pattern */}
        <StatCard label="Flagged more than once" value={Number(tally?.repeats ?? 0)}
          hint="children with an earlier referral too"
          tone={Number(tally?.repeats ?? 0) > 0 ? "warn" : "default"} />
      </div>

      <div className="mt-4">
        <Filters
          centers={isGlobalRole(user.role) ? centers : []}
          classes={classes}
          current={sp}
          dates
          extra={[
            { name: "status", label: "Any stage", options: [
              { value: "pending", label: "Not closed yet" },
              { value: "open", label: "Awaiting mentor" },
              { value: "in_progress", label: "Counselling under way" },
              { value: "closed", label: "Closed" },
            ] },
            { name: "urgency", label: "Any urgency", options: [
              { value: "high", label: "Urgent only" },
              { value: "normal", label: "Normal only" },
            ] },
            { name: "reason", label: "Any reason",
              options: FLAG_REASONS.map((x) => ({ value: x, label: x })) },
            { name: "by", label: "Flagged by anyone",
              options: raisers.map((u) => ({
                value: u.id, label: `${u.name} · ${ROLE_LABEL[u.role as Role] ?? u.role}` })) },
            { name: "mentor", label: "Any mentor",
              options: mentors.map((u) => ({ value: u.id, label: u.name })) },
            { name: "repeat", label: "First or repeat", options: [
              { value: "1", label: "Flagged more than once" },
            ] },
          ]}
        />
      </div>

      <Card className="mt-4 overflow-hidden" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No flagged children here"
            hint="A teacher flags a child from their profile. Try a wider period or another centre." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl align-top">
              <thead>
                <tr>
                  <SortHeader label="Student" col="student" {...sortProps} />
                  <SortHeader label="Class" col="class" {...sortProps} />
                  {!centerId && <SortHeader label="Centre" col="centre" {...sortProps} />}
                  <SortHeader label="Flagged on" col="flagged" {...sortProps} />
                  <th>Why, and who flagged it</th>
                  <SortHeader label="Mentor's action" col="action" {...sortProps} />
                  <SortHeader label="Stage" col="status" {...sortProps} />
                  <SortHeader label="Times flagged" col="times" {...sortProps} />
                  <SortHeader label="Days" col="waiting" {...sortProps} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/students/${r.student_id}`}
                        className="font-medium hover:text-[var(--brand)]">
                        {[r.first_name, r.last_name].filter(Boolean).join(" ")}
                      </Link>
                      <SiblingMark count={r.sibling_count} names={r.sibling_names} />
                      {r.times_flagged > 1 && (
                        <span className="ml-1.5 align-middle">
                          <Badge tone="warn">{r.times_flagged}× flagged</Badge>
                        </span>
                      )}
                      <div className="font-mono text-[12px] text-[var(--faint)]">
                        {r.enrollment_no}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    {!centerId && <td className="text-[var(--muted)]">{r.center_name}</td>}
                    <td className="whitespace-nowrap">
                      {fmtDate(r.raised_on)}
                      {r.urgency === "high" && <div className="mt-1"><Badge tone="bad">Urgent</Badge></div>}
                    </td>
                    <td className="max-w-[320px]">
                      <ul className="flex flex-wrap gap-1.5">
                        {(r.reasons ?? []).map((x) => (
                          <li key={x}
                            className="rounded-full bg-[#f4f4f9] px-2.5 py-1 text-[12px] text-[var(--muted)]">
                            {x}
                          </li>
                        ))}
                      </ul>
                      {r.note && <p className="mt-1.5 text-[13px] text-[var(--muted)]">{r.note}</p>}
                      <p className="mt-1.5 text-[12px] text-[var(--faint)]">
                        {r.raised_by_name ?? "—"}
                        {r.raised_by_role ? ` · ${ROLE_LABEL[r.raised_by_role as Role] ?? r.raised_by_role}` : ""}
                      </p>
                    </td>
                    <td className="max-w-[340px]">
                      {r.trail && r.trail.length > 0 ? (
                        <ul className="space-y-1.5">
                          {r.trail.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-[13px]">
                              <span className="whitespace-nowrap text-[var(--muted)]">
                                {fmtDate(s.on)} ·{" "}
                              </span>
                              <span className="text-[var(--muted)]">
                                {ACTION_LABEL[s.kind] ?? s.kind}
                              </span>
                              {s.note ? <> — {s.note}</> : null}
                              {s.by ? (
                                <span className="text-[12px] text-[var(--faint)]"> ({s.by})</span>
                              ) : null}
                            </li>
                          ))}
                          {r.trail.length > 3 && (
                            <li className="text-[12px] text-[var(--faint)]">
                              and {r.trail.length - 3} earlier step
                              {r.trail.length - 3 === 1 ? "" : "s"}
                            </li>
                          )}
                        </ul>
                      ) : (
                        <span className="text-[13px] text-[var(--faint)]">
                          {r.status === "open" ? "Nothing done yet" : "Not recorded"}
                        </span>
                      )}
                      {r.mentor_name && (
                        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
                          With {r.mentor_name}
                          {r.picked_up_on ? `, since ${fmtDate(r.picked_up_on)}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge tone={FLAG_STATUS_TONE[r.status]}>
                        {FLAG_STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      {r.closed_on && (
                        <div className="mt-1 text-[12px] text-[var(--faint)]">
                          {fmtDate(r.closed_on)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {r.times_flagged === 1
                        ? <span className="text-[13px] text-[var(--muted)]">First time</span>
                        : <>
                            <Badge tone="warn">{r.times_flagged} times</Badge>
                            <div className="mt-1 text-[12px] text-[var(--faint)]">
                              this is the {ordinal(r.nth)}
                            </div>
                          </>}
                    </td>
                    <td className="whitespace-nowrap text-[var(--muted)]">
                      {Number(r.days_open)}
                      <span className="text-[12px] text-[var(--faint)]">
                        {r.status === "closed" ? " to close" : " open"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="flagged student" />
      </Card>
    </>
  );
}
