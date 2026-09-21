import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { query } from "@/lib/db";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import { openVisit, sportsAt, visitsOn } from "@/lib/sports";
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
  const sports = centre ? await sportsAt(centre.id) : [];

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
              <Card pad={false}>
                <Empty title="No sports at this centre yet"
                  hint="Add the first one — it will show here every time this centre is chosen." />
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
          </div>
          <div className="lg:col-span-2">
            <AddSportForm centerId={centre.id} centreName={centre.name} />
          </div>
        </div>
      )}
    </>
  );
}
