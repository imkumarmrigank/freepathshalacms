import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, listClasses, resolveCenterId } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate } from "@/lib/format";
import { FLAG_STATUS_LABEL, FLAG_STATUS_TONE } from "@/lib/counselling-meta";
import { isGlobalRole } from "@/lib/roles";
import WorkFlag from "./WorkFlag";

export const metadata = { title: "Counselling · Pehchaan" };

type Row = {
  id: number; student_id: number; first_name: string; last_name: string | null;
  enrollment_no: string; center_name: string; class_name: string | null;
  reasons: string[]; note: string | null; urgency: string; status: string;
  raised_on: string; raised_by_name: string | null; mentor_name: string | null;
  outcome: string | null; closed_on: string | null; total_rows: string;
};

export default async function CounsellingPage({
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
  if (sp.status) { params.push(sp.status); where += ` AND f.status = $${params.length}`; }
  else where += " AND f.status <> 'closed'";
  if (sp.urgency) { params.push(sp.urgency); where += ` AND f.urgency = $${params.length}`; }

  const pg = pageFrom(sp, 25);
  params.push(pg.size, pg.offset);

  const rows = await query<Row>(
    `SELECT count(*) OVER () AS total_rows,
            f.id, f.student_id, s.first_name, s.last_name, s.enrollment_no,
            ce.name AS center_name, cl.name AS class_name,
            f.reasons, f.note, f.urgency, f.status, f.raised_on, f.outcome, f.closed_on,
            r.name AS raised_by_name, m.name AS mentor_name
       FROM counselling_flags f
       JOIN students s ON s.id = f.student_id
       JOIN centers ce ON ce.id = f.center_id
       LEFT JOIN class_levels cl ON cl.id = f.class_level_id
       LEFT JOIN users r ON r.id = f.raised_by
       LEFT JOIN users m ON m.id = f.mentor_id
      WHERE 1=1 ${where}
      ORDER BY (f.urgency = 'high') DESC, f.raised_on DESC, f.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);
  const canWork = user.role === "mentor" || isGlobalRole(user.role);

  return (
    <>
      <PageHeader title="Counselling"
        subtitle="Children a teacher has referred to the mentor" />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        extra={[
          { name: "status", label: "Open referrals", options: [
            { value: "open", label: "Awaiting mentor" },
            { value: "in_progress", label: "Counselling under way" },
            { value: "closed", label: "Closed" },
          ] },
          { name: "urgency", label: "Any urgency", options: [
            { value: "high", label: "Urgent only" },
            { value: "normal", label: "Normal only" },
          ] },
        ]}
      />

      <Card className="mt-4" pad={false}>
        {rows.length === 0 ? (
          <Empty title="Nothing waiting"
            hint="A teacher flags a child from their profile, and it appears here." />
        ) : (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-t border-[#f1f1f6] px-5 py-4 first:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/students/${r.student_id}`}
                    className="text-[14px] font-medium hover:text-[var(--brand)]">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ")}
                  </Link>
                  <span className="font-mono text-[12px] text-[var(--faint)]">{r.enrollment_no}</span>
                  <Badge tone={FLAG_STATUS_TONE[r.status]}>
                    {FLAG_STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                  {r.urgency === "high" && <Badge tone="bad">Urgent</Badge>}
                  <span className="text-[12px] text-[var(--muted)]">
                    {r.class_name ?? "—"} · {r.center_name} · {fmtDate(r.raised_on)}
                    {r.raised_by_name ? ` · ${r.raised_by_name}` : ""}
                  </span>
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.reasons.map((x) => (
                    <li key={x} className="rounded-full bg-[#f4f4f9] px-2.5 py-1 text-[12px] text-[var(--muted)]">
                      {x}
                    </li>
                  ))}
                </ul>
                {r.note && <p className="mt-1.5 text-[13px] text-[var(--muted)]">{r.note}</p>}
                {r.outcome && (
                  <p className="mt-1.5 text-[13px]">
                    <span className="text-[var(--muted)]">Outcome: </span>{r.outcome}
                    {r.mentor_name ? ` — ${r.mentor_name}` : ""}
                    {r.closed_on ? `, ${fmtDate(r.closed_on)}` : ""}
                  </p>
                )}
                {canWork && (
                  <WorkFlag flagId={r.id} status={r.status} outcome={r.outcome} />
                )}
              </li>
            ))}
          </ul>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="referral" />
      </Card>
    </>
  );
}
