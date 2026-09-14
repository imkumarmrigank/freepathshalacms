import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import Filters from "@/components/Filters";
import { centersForUser, currentSession, listClasses, resolveCenterId } from "@/lib/queries";
import { canEditSyllabus, isGlobalRole } from "@/lib/roles";
import { centreProgress, subjectsFor, unitsFor } from "@/lib/syllabus";
import { fmtDate } from "@/lib/format";
import { Alert } from "@/components/ui";

export const metadata = { title: "Syllabus · Pehchaan" };

const TONE: Record<string, string> = {
  completed: "ok", in_progress: "warn", not_started: "mute",
};
const LABEL: Record<string, string> = {
  completed: "Done", in_progress: "Under way", not_started: "Not started",
};

export default async function SyllabusPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("syllabus");
  const sp = await searchParams;
  const [centers, classes, session] = await Promise.all([
    centersForUser(user), listClasses(), currentSession(),
  ]);
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const centerId = resolveCenterId(user, sp.center);
  const classId = Number(sp.class) || classes[0]?.id;
  if (!classId) return <Alert kind="warn">No classes are set up yet.</Alert>;

  const subjects = await subjectsFor(session.id, classId);
  const subject = sp.subject && subjects.includes(sp.subject) ? sp.subject : null;

  const [units, centres] = await Promise.all([
    unitsFor(session.id, classId, centerId, subject),
    isGlobalRole(user.role) && !centerId
      ? centreProgress(session.id, classId, subject)
      : Promise.resolve([]),
  ]);

  const className = classes.find((c) => c.id === classId)?.name ?? "";

  return (
    <>
      <PageHeader
        title="Syllabus"
        subtitle={`What is to be taught in ${className}, month by month`}
        right={canEditSyllabus(user.role)
          ? <Link href="/manage/syllabus" className="btn btn-ghost">Set the syllabus</Link>
          : null}
      />

      <Filters
        centers={isGlobalRole(user.role) ? centers : []}
        classes={classes}
        current={sp}
        extra={subjects.length > 1 ? [{
          name: "subject", label: "All subjects",
          options: subjects.map((s) => ({ value: s, label: s })),
        }] : []}
      />

      {units.length === 0 ? (
        <Card className="mt-4" pad={false}>
          <Empty title="No syllabus for this class yet"
            hint={canEditSyllabus(user.role)
              ? "Set it up under Set the syllabus."
              : "An administrator sets this up."} />
        </Card>
      ) : (
        <>
          {/* ------------------------------------------ one centre's months */}
          {centerId && (
            <Card className="mt-4" pad={false}>
              <ul>
                {units.map((u) => {
                  const pct = Number(u.items) > 0
                    ? Math.round((Number(u.ticked) / Number(u.items)) * 100) : 0;
                  return (
                    <li key={u.id} className="border-t border-[#f1f1f6] first:border-0">
                      <Link href={`/syllabus/${u.id}?center=${centerId}`}
                        className="block px-5 py-4 hover:bg-[#fafafd]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--brand)]">
                            Month {u.month_no}
                          </span>
                          <span className="text-[14px] font-medium">{u.subject}</span>
                          {u.heading && (
                            <span className="text-[13px] text-[var(--muted)]">{u.heading}</span>
                          )}
                          <Badge tone={TONE[u.status]}>{LABEL[u.status]}</Badge>
                          {u.status === "completed" && u.completed_on && (
                            <span className="text-[12px] text-[var(--muted)]">
                              {fmtDate(u.completed_on)}
                              {u.marked_by_name ? ` · ${u.marked_by_name}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[#ececf3]">
                            <span className="block h-full rounded-full bg-[var(--brand)]"
                              style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-[12px] tabular-nums text-[var(--muted)]">
                            {u.ticked} of {u.items} covered
                          </span>
                        </div>
                        {u.outcome && (
                          <p className="mt-1 text-[12.5px] text-[var(--muted)]">{u.outcome}</p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* --------------------------------- every centre, for an admin */}
          {!centerId && centres.length > 0 && (
            <Card className="mt-4" pad={false}>
              <div className="border-b border-[var(--border)] px-5 py-3">
                <h2 className="text-[14px] font-semibold">How far each centre has got</h2>
                <p className="text-[12.5px] text-[var(--muted)]">
                  {units.length} month{units.length === 1 ? "" : "s"} in {className}
                  {subject ? ` ${subject}` : ""}. Pick a centre above to see its months.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-[0.05em] text-[var(--faint)]">
                      <th className="px-5 py-2.5 font-medium">Centre</th>
                      <th className="px-3 py-2.5 text-right font-medium">Done</th>
                      <th className="px-3 py-2.5 text-right font-medium">Under way</th>
                      <th className="px-5 py-2.5 font-medium">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {centres.map((c) => {
                      const pct = c.months > 0
                        ? Math.round((Number(c.completed) / Number(c.months)) * 100) : 0;
                      return (
                        <tr key={c.center_id} className="border-t border-[#f1f1f6]">
                          <td className="px-5 py-2.5">
                            <Link href={`/syllabus?center=${c.center_id}&class=${classId}${
                              subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
                              className="font-medium hover:text-[var(--brand)]">
                              {c.center_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {c.completed} / {c.months}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{c.in_progress}</td>
                          <td className="px-5 py-2.5">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#ececf3]">
                                <span className="block h-full rounded-full"
                                  style={{ width: `${pct}%`,
                                    background: pct >= 75 ? "var(--ok)" : pct >= 40 ? "#eab308" : "var(--warn)" }} />
                              </span>
                              <span className="text-[12px] tabular-nums text-[var(--muted)]">{pct}%</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
