import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { IconPlus } from "@/components/icons";
import { fmtDate, fullName, titleCase } from "@/lib/format";

const TONE: Record<string, string> = { attentive: "ok", neutral: "warn", resistant: "bad" };

export default async function PtmPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  const centerId = resolveCenterId(user, sp.center);

  const params: unknown[] = [session?.id ?? 0];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND i.center_id = $${params.length}`; }
  if (sp.class) { params.push(Number(sp.class)); where += ` AND i.class_level_id = $${params.length}`; }
  if (sp.engagement) { params.push(sp.engagement); where += ` AND i.engagement = $${params.length}`; }
  if (sp.q) {
    params.push(`%${sp.q.trim()}%`);
    where += ` AND (s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length}
                    OR s.enrollment_no ILIKE $${params.length} OR u.name ILIKE $${params.length})`;
  }

  const rows = await query<{
    id: number; interaction_date: string; first_name: string; last_name: string | null;
    enrollment_no: string; mentor: string | null; parent_present: string; engagement: string;
    center_name: string; class_name: string | null;
    follow_up_required: boolean; follow_up_status: string;
  }>(
    `SELECT i.id, i.interaction_date, s.first_name, s.last_name, s.enrollment_no,
            u.name AS mentor, i.parent_present, i.engagement, ce.name AS center_name,
            cl.name AS class_name, i.follow_up_required, i.follow_up_status
       FROM ptm_interactions i
       JOIN students s ON s.id = i.student_id
       JOIN centers ce ON ce.id = i.center_id
       LEFT JOIN users u ON u.id = i.mentor_id
       LEFT JOIN class_levels cl ON cl.id = i.class_level_id
      WHERE i.session_id = $1 ${where}
      ORDER BY i.interaction_date DESC, i.id DESC LIMIT 300`,
    params,
  );

  return (
    <>
      <PageHeader title="PTM interactions"
        subtitle={`${rows.length} interaction${rows.length === 1 ? "" : "s"} in ${session?.name ?? "this session"}`}
        right={
          <>
            <Link href="/ptm/meetings" className="btn btn-ghost">Scheduled PTMs</Link>
            <Link href="/ptm/new" className="btn btn-primary">
              <IconPlus className="h-4 w-4" /> Record Parent Interaction
            </Link>
          </>
        } />

      <Filters
        centers={user.role === "super_admin" ? centers : []}
        classes={classes}
        current={sp}
        searchPlaceholder="Search student or mentor"
        extra={[{ name: "engagement", label: "All engagement",
          options: ["attentive", "neutral", "resistant"].map((v) => ({ value: v, label: titleCase(v) })) }]}
      />

      <Card className="mt-4 overflow-hidden" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No interactions recorded"
            hint="Record what was discussed with a parent, and the follow-up it needs."
            action={
              <Link href="/ptm/new" className="btn btn-primary btn-sm">
                <IconPlus className="h-3.5 w-3.5" /> Record Parent Interaction
              </Link>
            } />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th><th>Student</th><th>Class</th><th>Mentor</th>
                  <th>Parent</th><th>Engagement</th><th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-medium">
                      <Link href={`/ptm/${r.id}`} className="hover:text-[var(--brand)]">
                        {fmtDate(r.interaction_date)}
                      </Link>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={fullName(r)} size={30} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{fullName(r)}</div>
                          <div className="font-mono text-[11px] text-[var(--faint)]">{r.enrollment_no}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-[var(--muted)]">{r.class_name ?? "—"}</td>
                    <td className="text-[var(--muted)]">{r.mentor ?? "—"}</td>
                    <td className="capitalize text-[var(--muted)]">{r.parent_present}</td>
                    <td><Badge tone={TONE[r.engagement]}>{titleCase(r.engagement)}</Badge></td>
                    <td>
                      {!r.follow_up_required
                        ? <span className="text-[var(--faint)]">—</span>
                        : r.follow_up_status === "pending"
                          ? <Badge tone="warn">Pending</Badge>
                          : <Badge tone="ok">{titleCase(r.follow_up_status)}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
