import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate, today } from "@/lib/format";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { isGlobalRole } from "@/lib/roles";
import { teacherDays } from "@/lib/day-book";
import TeacherRows from "./TeacherRows";

export const metadata = { title: "Teacher day book · Pehchaan" };

const FOCUS = [
  { value: "unwritten", label: "Only days not written up" },
  { value: "written", label: "Only days written up" },
  { value: "nocheckin", label: "Only days with no check-in" },
  { value: "byhand", label: "Only manual check-ins" },
];

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Every teacher's day, in one list: when they were at the centre, what the
 * register came to, and whether the lesson was written up. A row opens the
 * day in full — the punch, the register class by class, why each child was
 * away, and the teacher's own account of the lesson.
 */
export default async function TeacherDayBookPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("super_admin", "admin", "center_manager");
  const sp = await searchParams;

  const days = RANGES.some((r) => r.value === sp.days) ? Number(sp.days) : 7;
  const now = today();
  const from = sp.from || addDays(now, -(days - 1));
  const to = sp.to || now;
  const centerId = resolveCenterId(user, sp.center);
  const focus = FOCUS.some((f) => f.value === sp.focus) ? (sp.focus as string) : null;
  const pg = pageFrom(sp, 50);

  const [centers, teachers] = await Promise.all([
    centersForUser(user),
    query<{ id: number; name: string; is_active: boolean }>(
      `SELECT id, name, is_active FROM users
        WHERE role IN ('teacher', 'backup_teacher')
          ${centerId ? "AND center_id = $1" : ""}
        ORDER BY is_active DESC, name`, centerId ? [centerId] : []),
  ]);
  const who = teachers.some((t) => String(t.id) === sp.who) ? Number(sp.who) : null;
  const rows = await teacherDays(from, to, centerId, who, focus, pg);

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);

  const written = rows.filter((r) => r.notes_written > 0).length;
  const checkedIn = rows.filter((r) => r.check_in).length;
  const present = rows.reduce((n, r) => n + r.present, 0);
  const absent = rows.reduce((n, r) => n + r.absent, 0);

  return (
    <>
      <PageHeader title="Teacher day book"
        subtitle={`${fmtDate(from)} to ${fmtDate(to)} · check-in, register and the lesson written up`}
        right={<Link href="/reports?report=teacher-daily" className="btn btn-ghost btn-sm">
          Download
        </Link>} />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        current={sp}
        dates
        extra={[
          { name: "days", label: "Last 7 days", options: RANGES },
          { name: "focus", label: "Every day", options: FOCUS },
          { name: "who", label: "Every teacher",
            options: teachers.map((t) => ({
              value: t.id, label: t.is_active ? t.name : `${t.name} (inactive)` })) },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Teacher-days" value={rows.length}
          hint={`${checkedIn} with a check-in`} />
        <StatCard label="Days written up" value={written}
          hint={rows.length ? `${Math.round((written / rows.length) * 100)}% of them` : "—"}
          tone={rows.length && written === rows.length ? "ok"
            : written === 0 ? "bad" : "warn"} />
        <StatCard label="Children present" value={present} />
        <StatCard label="Children absent" value={absent}
          hint={present + absent ? `${Math.round((present / (present + absent)) * 100)}% attendance` : "—"}
          tone={absent > present ? "warn" : "default"} />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title="No teacher days in this period"
            hint="Nobody checked in, marked a register or wrote up a lesson between these dates." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th><th>Teacher</th><th>In</th><th>Out</th><th>At the centre</th>
                  <th>Classes</th><th>Present</th><th>Absent</th><th>The lesson</th>
                </tr>
              </thead>
              <TeacherRows rows={rows} />
            </table>
          </div>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit="teacher-day" />
      </Card>
    </>
  );
}
