import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import { listClasses } from "@/lib/queries";
import { isTeaching } from "@/lib/roles";
import { teacherDayDetail, teacherDays } from "@/lib/day-book";
import DayNoteForm from "./DayNoteForm";

export const metadata = { title: "My day book · Pehchaan" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The teacher's own day book: what the system already knows about their day —
 * when they checked in, what the register came to — and the part only they can
 * write, in Hindi or English.
 */
export default async function MyDayPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (!isTeaching(user.role) && user.role !== "center_manager") redirect("/dashboard");
  const sp = await searchParams;

  const now = today();
  const day = sp.day && sp.day <= now ? sp.day : now;
  const [detail, classes, recent] = await Promise.all([
    teacherDayDetail(day, user.uid),
    listClasses(),
    teacherDays(addDays(now, -29), now, null, user.uid),
  ]);

  const { punch, byClass, reasons, notes } = detail;
  const present = byClass.reduce((n, c) => n + c.present, 0);
  const absent = byClass.reduce((n, c) => n + c.absent, 0);
  const written = notes.length;

  return (
    <>
      <PageHeader title="My day book"
        subtitle={`${fmtDate(day)} · what you did today, in your own words`}
        back={day === now ? undefined : { href: "/my-day", label: "Today" }}
        right={
          <>
            <Link href={`/my-day?day=${addDays(day, -1)}`} className="btn btn-ghost btn-sm">
              ← Day before
            </Link>
            {day < now && (
              <Link href={`/my-day?day=${addDays(day, 1)}`} className="btn btn-ghost btn-sm">
                Day after →
              </Link>
            )}
          </>
        } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="You checked in" value={punch?.check_in ?? "—"}
          hint={punch?.by_hand ? "entered by hand" : punch?.distance_m != null
            ? `${punch.distance_m} m from the centre` : "not checked in"}
          tone={punch?.check_in ? "ok" : "warn"} />
        <StatCard label="You checked out" value={punch?.check_out ?? "—"}
          hint={punch?.minutes ? `${Math.floor(punch.minutes / 60)}h ${punch.minutes % 60}m at the centre` : "still open"} />
        <StatCard label="Children present" value={present}
          hint={`${byClass.length} class${byClass.length === 1 ? "" : "es"} marked`} />
        <StatCard label="Children absent" value={absent}
          tone={absent > present ? "warn" : "default"}
          hint={reasons.length ? `${reasons.length} reason${reasons.length === 1 ? "" : "s"} given` : "no reasons given"} />
      </div>

      {byClass.length > 0 && (
        <>
          <div className="label-cap mb-2.5 mt-6">Your register on {fmtDate(day)}</div>
          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th>Class</th><th>Section</th><th>Present</th><th>Absent</th>
                    <th>Marked at</th></tr>
                </thead>
                <tbody>
                  {byClass.map((c, i) => (
                    <tr key={i}>
                      <td className="font-medium">{c.class_name}</td>
                      <td className="text-[var(--muted)]">{c.section ?? "—"}</td>
                      <td className="tabular-nums">{c.present}</td>
                      <td className="tabular-nums">{c.absent}</td>
                      <td className="whitespace-nowrap text-[var(--muted)]">{c.marked_at ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {reasons.length > 0 && (
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Why they were away: {reasons.map((r) => `${r.reason} (${r.n})`).join(" · ")}
            </p>
          )}
        </>
      )}

      <div className="label-cap mb-2.5 mt-6">
        {written === 0 ? "Write up the day" : "What you wrote"}
      </div>

      {notes.map((n) => (
        <Card key={n.id} className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{n.class_name ?? "The whole day"}</Badge>
            {n.subject && <span className="text-[13px] text-[var(--muted)]">{n.subject}</span>}
            <span className="ml-auto text-[12px] text-[var(--faint)]">saved {n.updated_at}</span>
          </div>
          <dl className="mt-3 space-y-2 text-[13.5px]">
            {n.chapter && (
              <div><dt className="text-[var(--muted)]">Taught</dt>
                <dd>{n.chapter}{n.chapter_detail ? ` — ${n.chapter_detail}` : ""}</dd></div>
            )}
            {n.homework && (
              <div><dt className="text-[var(--muted)]">Homework</dt>
                <dd>{n.homework}{n.homework_detail ? ` — ${n.homework_detail}` : ""}</dd></div>
            )}
            {n.equipment && (
              <div><dt className="text-[var(--muted)]">Used</dt>
                <dd>{n.equipment}{n.equipment_result ? ` — ${n.equipment_result}` : ""}</dd></div>
            )}
            {n.extra_activity && (
              <div><dt className="text-[var(--muted)]">Beyond the class</dt>
                <dd>{n.extra_activity}{n.extra_detail ? ` — ${n.extra_detail}` : ""}</dd></div>
            )}
            {n.other_work && (
              <div><dt className="text-[var(--muted)]">Also did</dt><dd>{n.other_work}</dd></div>
            )}
            {n.support_needed && (
              <div><dt className="text-[var(--muted)]">Help needed</dt>
                <dd className="text-[var(--warn)]">{n.support_needed}</dd></div>
            )}
          </dl>
        </Card>
      ))}

      <DayNoteForm date={day} classes={classes} />

      <div className="label-cap mb-2.5 mt-6">Your last thirty days</div>
      <Card pad={false}>
        {recent.length === 0 ? (
          <Empty title="Nothing yet" hint="Your days appear here as you check in and write them up." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Day</th><th>In</th><th>Out</th><th>Present</th><th>Absent</th>
                  <th>Written up</th><th></th></tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap font-medium">{fmtDate(r.day)}</td>
                    <td className="text-[var(--muted)]">{r.check_in ?? "—"}</td>
                    <td className="text-[var(--muted)]">{r.check_out ?? "—"}</td>
                    <td className="tabular-nums">{r.present || "—"}</td>
                    <td className="tabular-nums">{r.absent || "—"}</td>
                    <td>
                      {r.notes_written > 0
                        ? <Badge tone="ok">{r.chapters ?? "written"}</Badge>
                        : <span className="text-[13px] text-[var(--faint)]">not written</span>}
                    </td>
                    <td>
                      <Link href={`/my-day?day=${r.day}`}
                        className="text-[13px] text-[var(--brand)] hover:underline">Open</Link>
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
