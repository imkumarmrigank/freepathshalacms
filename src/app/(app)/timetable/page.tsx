import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import SlotForm from "./SlotForm";
import { TEACHING_DAYS } from "@/lib/timetable-meta";
import DeleteSlot from "./DeleteSlot";
import { isGlobalRole } from "@/lib/roles";

type Slot = {
  id: number; class_level_id: number; class_name: string; day_of_week: number;
  period_no: number; start_time: string; end_time: string; subject: string;
  teacher_id: number | null; teacher: string | null; room: string | null;
};

export default async function TimetablePage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const centerId = resolveCenterId(user, sp.center) ?? (centers.length === 1 ? centers[0].id : null);
  const canEdit = user.role !== "teacher";
  // Teachers land on their own week; managers look at one class at a time.
  const view = sp.view ?? (user.role === "teacher" ? "mine" : "class");
  const classId = Number(sp.class) || null;

  const params: unknown[] = [session.id];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND t.center_id = $${params.length}`; }
  if (view === "mine") { params.push(user.uid); where += ` AND t.teacher_id = $${params.length}`; }
  else if (classId) { params.push(classId); where += ` AND t.class_level_id = $${params.length}`; }

  const slots = view === "class" && !classId ? [] : await query<Slot>(
    `SELECT t.id, t.class_level_id, cl.name AS class_name, t.day_of_week, t.period_no,
            t.start_time, t.end_time, t.subject, t.teacher_id, u.name AS teacher, t.room
       FROM timetable_slots t
       JOIN class_levels cl ON cl.id = t.class_level_id
       LEFT JOIN users u ON u.id = t.teacher_id
      WHERE t.session_id = $1 ${where}
      ORDER BY t.period_no, t.day_of_week`,
    params,
  );

  const teachers = centerId
    ? await query<{ id: number; name: string }>(
        `SELECT id, name FROM users
          WHERE is_active AND center_id = $1 AND role IN ('teacher','center_manager')
          ORDER BY name`, [centerId])
    : [];

  const periods = [...new Set(slots.map((s) => s.period_no))].sort((a, b) => a - b);
  const at = (p: number, d: number) => slots.find((s) => s.period_no === p && s.day_of_week === d);
  const timeOf = (p: number) => {
    const s = slots.find((x) => x.period_no === p);
    return s ? `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}` : "";
  };

  const link = (patch: Record<string, string>) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>,
    );
    return `/timetable?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={view === "mine"
          ? `Your week · session ${session.name}`
          : `Weekly plan by class · session ${session.name}`}
        right={
          <div className="flex gap-2">
            <Link href={link({ view: "class" })}
              className={`btn btn-sm ${view === "class" ? "btn-primary" : "btn-ghost"}`}>By class</Link>
            <Link href={link({ view: "mine" })}
              className={`btn btn-sm ${view === "mine" ? "btn-primary" : "btn-ghost"}`}>My week</Link>
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="view" value={view} />
        {isGlobalRole(user.role) && (
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Centre</span>
            <select className="select w-auto" name="center" defaultValue={sp.center ?? ""}>
              <option value="">Select centre</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </label>
        )}
        {view === "class" && (
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Class</span>
            <select className="select w-auto" name="class" defaultValue={sp.class ?? ""}>
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <button className="btn btn-ghost mb-[1px] h-[38px]" type="submit">Show</button>
      </form>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card pad={false}>
            {view === "class" && !classId ? (
              <Empty title="Pick a class" hint="Choose a class above to see its week." />
            ) : slots.length === 0 ? (
              <Empty title="Nothing scheduled yet"
                hint={view === "mine"
                  ? "Your centre manager has not put you on the timetable yet."
                  : "Add periods using the form to build this class's week."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="w-[110px]">Period</th>
                      {TEACHING_DAYS.map((d) => <th key={d}>{d.slice(0, 3)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => (
                      <tr key={p}>
                        <td className="align-top">
                          <div className="font-medium">Period {p}</div>
                          <div className="text-[12px] text-[var(--muted)]">{timeOf(p)}</div>
                        </td>
                        {TEACHING_DAYS.map((d, i) => {
                          const s = at(p, i + 1);
                          return (
                            <td key={d} className="align-top">
                              {s ? (
                                <div className="rounded-[8px] bg-[var(--brand-soft)] px-2 py-1.5">
                                  <div className="text-[13px] font-medium">{s.subject}</div>
                                  <div className="text-[11px] text-[var(--muted)]">
                                    {view === "mine" ? s.class_name : s.teacher ?? "Unassigned"}
                                    {s.room ? ` · ${s.room}` : ""}
                                  </div>
                                  {canEdit && <div className="mt-0.5"><DeleteSlot id={s.id} /></div>}
                                </div>
                              ) : (
                                <span className="text-[var(--faint)]">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {canEdit && (
          <SlotForm classes={classes} teachers={teachers} centers={centers}
            isAdmin={isGlobalRole(user.role)} defaultClassId={classId}
            defaultCenterId={centerId} />
        )}
      </div>
    </>
  );
}
