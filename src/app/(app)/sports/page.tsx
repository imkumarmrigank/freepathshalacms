import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import { childrenAt, openVisit, sportsAt, visitsOn } from "@/lib/sports";
import { currentSession } from "@/lib/queries";
import { AddSportForm } from "./SportForms";
import VisitCard from "./VisitCard";

export const metadata = { title: "Sports · Pehchaan" };

export default async function SportsPage({
  searchParams,
}: { searchParams: Promise<{ center?: string; denied?: string }> }) {
  const user = await requireFeature("sports");
  const sp = await searchParams;
  const visiting = user.role === "sports_teacher";

  // Every centre, with how much sport is going on there — the sports teacher
  // chooses where they are standing today.
  const centres = await query<{
    id: number; code: string; name: string; sports: number; players: number;
    has_coords: boolean;
  }>(
    `SELECT c.id, c.code, c.name,
            (c.latitude IS NOT NULL AND c.longitude IS NOT NULL) AS has_coords,
            count(DISTINCT sp.id) FILTER (WHERE sp.is_active)::int AS sports,
            count(DISTINCT ss.student_id) FILTER (WHERE sp.is_active)::int AS players
       FROM centers c
       LEFT JOIN sports sp ON sp.center_id = c.id
       LEFT JOIN sport_students ss ON ss.sport_id = sp.id AND ss.left_on IS NULL
      WHERE c.is_active
      GROUP BY c.id
      ORDER BY c.code`);

  // Where the sports teacher is checked in decides the centre when none is chosen.
  const [open, visitsToday] = visiting
    ? await Promise.all([openVisit(user.uid), visitsOn(user.uid, today())])
    : [null, []];
  const centerId = Number(sp.center) || open?.center_id || null;
  const centre = centres.find((c) => c.id === centerId) ?? null;
  const session = await currentSession();
  const [sports, children] = centre
    ? await Promise.all([
        sportsAt(centre.id),
        session ? childrenAt(centre.id, session.id) : Promise.resolve([]),
      ])
    : [[], []];

  return (
    <>
      {sp.denied && <div className="mb-5"><Alert kind="bad">You don’t have access to that page.</Alert></div>}
      <PageHeader title="Sports"
        subtitle={centre ? `${centre.code} · ${centre.name}` : "Choose the centre you are at"} />

      <div className="mb-5 flex flex-wrap gap-2">
        {centres.map((c) => (
          <Link key={c.id} href={`/sports?center=${c.id}`}
            className={`btn btn-sm ${c.id === centerId ? "btn-primary" : "btn-ghost"}`}>
            {c.code} · {c.name}
            {c.sports > 0 && <span className="ml-1 opacity-70">({c.sports})</span>}
          </Link>
        ))}
      </div>

      {visiting && centre && (
        <VisitCard centerId={centre.id} centreName={centre.name} hasCoords={centre.has_coords}
          open={open} today={today()} visitsToday={visitsToday}
          sports={sports.filter((x) => x.is_active).map((x) => x.name)} />
      )}

      {!centre ? (
        <Card pad={false}>
          <Empty title="Pick a centre"
            hint="Its games, and the children who play them, will open here." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {sports.length === 0 ? (
              <Card>
                <h2 className="mb-2 text-[15px] font-semibold">No sports at this centre yet</h2>
                <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-[var(--muted)]">
                  <li>Add a sport with the form on the right (below, on a phone).</li>
                  <li>Open the sport by tapping its card here.</li>
                  <li>On its Players tab, tick the children who are joining and add them.</li>
                  <li>Then take their attendance, tests and remarks.</li>
                </ol>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sports.map((s) => (
                  <Link key={s.id} href={`/sports/${s.id}`}
                    className={`card card-pad block transition hover:border-[var(--brand)] ${s.is_active ? "" : "opacity-60"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[16px] font-semibold">{s.name}</div>
                      {!s.is_active && <Badge tone="mute">Paused</Badge>}
                    </div>
                    {s.description && (
                      <div className="mt-0.5 text-[12px] text-[var(--muted)]">{s.description}</div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                      <span><strong>{s.players}</strong> <span className="text-[var(--muted)]">playing</span></span>
                      <span><strong>{s.special}</strong> <span className="text-[var(--muted)]">talented</span></span>
                      <span><strong>{s.tests}</strong> <span className="text-[var(--muted)]">tests</span></span>
                    </div>
                    <div className="mt-1.5 text-[12px] text-[var(--faint)]">
                      {s.last_session ? `Last attendance ${fmtDate(s.last_session)}` : "No attendance taken yet"}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <details className="card mt-5" open={children.length > 0 && sports.every((x) => x.players === 0)}>
              <summary className="cursor-pointer px-5 py-3 text-[14px] font-semibold">
                Children at this centre ({children.length})
                <span className="ml-2 text-[12.5px] font-normal text-[var(--muted)]">
                  {children.filter((c) => c.sports.length > 0).length} already in a sport
                </span>
              </summary>
              {children.length === 0 ? (
                <p className="px-5 pb-4 text-[13px] text-[var(--muted)]">Nobody is on this centre&rsquo;s roll.</p>
              ) : (
                <div className="max-h-[420px] overflow-y-auto border-t border-[var(--border)]">
                  <table className="tbl">
                    <tbody>
                      {children.map((c) => (
                        <tr key={c.student_id}>
                          <td>
                            <div className="font-medium">{c.first_name} {c.last_name ?? ""}</div>
                            <div className="font-mono text-[11px] text-[var(--faint)]">{c.enrollment_no}</div>
                          </td>
                          <td className="text-[var(--muted)]">{c.class_name ?? "—"}{c.section ? ` · ${c.section}` : ""}</td>
                          <td className="text-[12.5px]">
                            {c.sports.length
                              ? c.sports.join(", ")
                              : <span className="text-[var(--faint)]">not in a sport yet</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {sports.length > 0 && (
                <p className="border-t border-[var(--border)] px-5 py-3 text-[12.5px] text-[var(--muted)]">
                  To add a child to a sport, open the sport above and use its Players tab.
                </p>
              )}
            </details>
          </div>
          <div className="lg:col-span-2">
            <AddSportForm centerId={centre.id} centreName={centre.name} />
          </div>
        </div>
      )}
    </>
  );
}
