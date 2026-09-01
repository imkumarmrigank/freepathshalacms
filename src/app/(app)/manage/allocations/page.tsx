import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import AllocationRow from "./AllocationRow";

export default async function AllocationsPage() {
  const user = await requireUser();
  if (user.role === "teacher")
    return <Alert kind="bad">You don’t have access to class allocation.</Alert>;

  const [classes, session] = await Promise.all([listClasses(), currentSession()]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;
  const centerId = resolveCenterId(user, null);

  const teachers = await query<{
    id: number; name: string; email: string; center_name: string | null;
  }>(
    `SELECT u.id, u.name, u.email, c.name AS center_name
       FROM users u LEFT JOIN centers c ON c.id = u.center_id
      WHERE u.is_active AND u.role = 'teacher' ${centerId ? "AND u.center_id = $1" : ""}
      ORDER BY c.code, u.name`,
    centerId ? [centerId] : [],
  );

  const allocations = await query<{ user_id: number; class_level_id: number }>(
    "SELECT user_id, class_level_id FROM teacher_classes WHERE session_id = $1",
    [session.id],
  );
  const byTeacher = new Map<number, number[]>();
  for (const a of allocations) {
    byTeacher.set(a.user_id, [...(byTeacher.get(a.user_id) ?? []), a.class_level_id]);
  }

  return (
    <>
      <PageHeader title="Class allocation"
        subtitle={`Which classes each teacher holds in session ${session.name} — this is what teaching plans and the timetable draw on`} />

      <Card pad={false}>
        {teachers.length === 0 ? (
          <Empty title="No teachers yet" hint="Add teachers under Administration → Staff." />
        ) : (
          teachers.map((t) => (
            <AllocationRow key={t.id} teacher={t} classes={classes}
              allotted={byTeacher.get(t.id) ?? []} />
          ))
        )}
      </Card>
    </>
  );
}
