import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { listClasses } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import ClassForm from "./ClassForm";

export default async function ClassesPage({
  searchParams,
}: { searchParams: Promise<{ edit?: string }> }) {
  await requireRole("super_admin");
  const { edit } = await searchParams;
  const classes = await listClasses(false);
  const editing = edit
    ? await one<{ id: number; name: string; sequence: number; is_terminal: boolean; is_active: boolean }>(
        "SELECT * FROM class_levels WHERE id = $1", [Number(edit)])
    : null;

  const counts = await query<{ class_level_id: number; n: string }>(
    `SELECT e.class_level_id, count(*) AS n FROM enrollments e
       JOIN academic_sessions s ON s.id = e.session_id AND s.is_current
      WHERE e.status = 'active' GROUP BY e.class_level_id`,
  );
  const byId = new Map(counts.map((c) => [Number(c.class_level_id), c.n]));

  return (
    <>
      <PageHeader title="Classes"
        subtitle="The promotion ladder — students move up in this order at the end of each session"
        right={edit ? <Link href="/manage/classes" className="btn btn-ghost">Cancel edit</Link> : undefined} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {classes.length === 0 ? <Empty title="No classes defined" /> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Order</th><th>Class</th><th>Students now</th><th>Notes</th><th></th></tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c.id}>
                        <td className="tabular-nums text-[var(--muted)]">{c.sequence}</td>
                        <td className="font-medium">{c.name}</td>
                        <td className="tabular-nums">{byId.get(c.id) ?? 0}</td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {c.is_terminal && <Badge tone="info">Final class — graduates</Badge>}
                            {!c.is_active && <Badge tone="mute">Inactive</Badge>}
                          </div>
                        </td>
                        <td><Link href={`/manage/classes?edit=${c.id}`} className="btn btn-ghost btn-sm">Edit</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <div className="lg:col-span-2">
          <ClassForm cls={editing} key={editing?.id ?? "new"}
            nextSequence={(classes.at(-1)?.sequence ?? 0) + 1} />
        </div>
      </div>
    </>
  );
}
