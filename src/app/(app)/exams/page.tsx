import Link from "next/link";
import { requireFeature, effectiveTeacherIds } from "@/lib/auth";
import { query } from "@/lib/db";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { Alert, Badge, Card, Empty, Meter, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { fmtDate } from "@/lib/format";
import { EXAM_TYPE_LABEL, EXAM_TYPES } from "@/lib/exam-meta";
import NewExamForm from "./NewExamForm";
import { isGlobalRole, isTeaching } from "@/lib/roles";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";

export default async function ExamsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("exams");
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const centerId = resolveCenterId(user, sp.center);
  const params: unknown[] = [session.id];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND e.center_id = $${params.length}`; }
  if (sp.class) { params.push(Number(sp.class)); where += ` AND e.class_level_id = $${params.length}`; }
  if (sp.type) { params.push(sp.type); where += ` AND e.exam_type = $${params.length}`; }

  // Tests are listed by test, not by paper — a single test can now be scheduled
  // across every class and centre at once, so the page turns on whole tests and
  // a test's subjects are never split across two pages.
  const pg = pageFrom(sp, 20);
  const groupParams = [...params, pg.size, pg.offset];

  const groupKeys = await query<{
    exam_type: string; grp: string; class_level_id: number; center_id: number;
    total_rows: string;
  }>(
    `SELECT count(*) OVER () AS total_rows,
            e.exam_type, COALESCE(e.term_label, e.title) AS grp,
            e.class_level_id, e.center_id
       FROM exams e
      WHERE e.session_id = $1 ${where}
      GROUP BY e.exam_type, COALESCE(e.term_label, e.title), e.class_level_id, e.center_id
      ORDER BY max(e.exam_date) DESC, e.class_level_id, e.center_id
      LIMIT $${groupParams.length - 1} OFFSET $${groupParams.length}`,
    groupParams,
  );

  const totalGroups = totalOf(groupKeys);
  const win = pageWindow(pg, groupKeys.length, totalGroups);

  const rowParams = [
    session.id,
    groupKeys.map((g) => g.exam_type),
    groupKeys.map((g) => g.grp),
    groupKeys.map((g) => g.class_level_id),
    groupKeys.map((g) => g.center_id),
  ];

  const exams = groupKeys.length === 0 ? [] : await query<{
    id: number; title: string; subject: string; exam_type: string; exam_date: string;
    term_label: string | null; max_marks: string; class_name: string; center_name: string;
    status: string; teacher: string | null; entered: string; roster: string; average: string | null;
  }>(
    `SELECT e.id, e.title, e.subject, e.exam_type, e.exam_date, e.term_label, e.max_marks,
            cl.name AS class_name, ce.name AS center_name, e.status, u.name AS teacher,
            (SELECT count(*) FROM exam_marks m
              WHERE m.exam_id = e.id AND (m.marks_obtained IS NOT NULL OR m.is_absent)) AS entered,
            (SELECT count(*) FROM enrollments en
              WHERE en.session_id = e.session_id AND en.class_level_id = e.class_level_id
                AND en.center_id = e.center_id AND en.status = 'active') AS roster,
            (SELECT round(avg(m.marks_obtained), 1) FROM exam_marks m
              WHERE m.exam_id = e.id AND m.marks_obtained IS NOT NULL) AS average
       FROM exams e
       JOIN class_levels cl ON cl.id = e.class_level_id
       JOIN centers ce ON ce.id = e.center_id
       LEFT JOIN users u ON u.id = e.created_by
      WHERE e.session_id = $1
        AND (e.exam_type, COALESCE(e.term_label, e.title), e.class_level_id, e.center_id)
            IN (SELECT * FROM unnest($2::text[], $3::text[], $4::bigint[], $5::bigint[]))
      ORDER BY e.exam_date DESC, e.class_level_id, COALESCE(e.term_label, e.title), e.subject`,
    rowParams,
  );

  // A teacher only sets tests for the classes they hold.
  const myClasses = isTeaching(user.role)
    ? await query<{ id: number; name: string }>(
        `SELECT cl.id, cl.name FROM teacher_classes tc
           JOIN class_levels cl ON cl.id = tc.class_level_id
          WHERE tc.user_id = ANY($1::bigint[]) AND tc.session_id = $2 ORDER BY cl.sequence`,
        [effectiveTeacherIds(user), session.id])
    : classes;

  // subjects of the same test sit together under one heading
  type Group = { key: string; title: string; type: string; date: string;
                 className: string; centerName: string; rows: typeof exams };
  const groups: Group[] = [];
  for (const e of exams) {
    const key = `${e.exam_type}||${(e.term_label ?? e.title).toLowerCase()}||${e.class_name}||${e.center_name}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, title: e.term_label ?? e.title, type: e.exam_type, date: e.exam_date,
            className: e.class_name, centerName: e.center_name, rows: [] };
      groups.push(g);
    }
    g.rows.push(e);
  }

  return (
    <>
      <PageHeader title="Tests and marks"
        subtitle={`${totalGroups} test${totalGroups === 1 ? "" : "s"} · monthly, quarterly, ` +
          `half yearly and yearly results · session ${session.name}`} />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        extra={[{ name: "type", label: "All types",
          options: EXAM_TYPES.map((t) => ({ value: t.value, label: t.label })) }]}
      />

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card pad={false}>
            {exams.length === 0 ? (
              <Empty title="No tests yet"
                hint="Set up a test, then enter the whole class's marks in one grid." />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Subject</th><th>Class</th><th>Date</th>
                      <th>Marks entered</th><th>Average</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.flatMap((g) => [
                      <tr key={g.key} className="bg-[#fafaff]">
                        <td colSpan={6} className="py-2">
                          <span className="text-[13px] font-semibold">{g.title}</span>
                          <span className="ml-2 text-[12px] text-[var(--muted)]">
                            {EXAM_TYPE_LABEL[g.type] ?? g.type} · {g.className} · {g.centerName}
                            {" · "}{g.rows.length} subject{g.rows.length === 1 ? "" : "s"}
                          </span>
                        </td>
                      </tr>,
                      ...g.rows.map((e) => {
                      const entered = Number(e.entered), roster = Number(e.roster);
                      const avgPct = e.average === null
                        ? null : (Number(e.average) / Number(e.max_marks)) * 100;
                      return (
                        <tr key={e.id}>
                          <td className="pl-8">
                            <Link href={`/exams/${e.id}`} className="font-medium hover:text-[var(--brand)]">
                              {e.subject}
                            </Link>
                            <div className="text-[12px] text-[var(--muted)]">
                              out of {Number(e.max_marks)}
                            </div>
                          </td>
                          <td className="text-[var(--muted)]">{e.class_name}</td>
                          <td className="whitespace-nowrap text-[var(--muted)]">{fmtDate(e.exam_date)}</td>
                          <td className="whitespace-nowrap tabular-nums">
                            {entered}/{roster}
                          </td>
                          <td>
                            {avgPct === null
                              ? <span className="text-[var(--faint)]">—</span>
                              : <Meter value={avgPct} />}
                          </td>
                          <td>
                            {e.status === "published"
                              ? <Badge tone="ok">Published</Badge>
                              : entered === 0
                                ? <Badge tone="mute">Not started</Badge>
                                : entered < roster
                                  ? <Badge tone="warn">In progress</Badge>
                                  : <Badge tone="info">Complete</Badge>}
                          </td>
                        </tr>
                      );
                      }),
                    ])}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
              total={totalGroups} unit="test" />
          </Card>
        </div>

        <NewExamForm classes={myClasses} centers={centers}
          isAdmin={isGlobalRole(user.role)} isTeacher={isTeaching(user.role)} />
      </div>
    </>
  );
}
