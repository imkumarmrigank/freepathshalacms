import Link from "next/link";
import { notFound } from "next/navigation";
import { canTouchCenter, requireFeature } from "@/lib/auth";
import { currentSession } from "@/lib/queries";
import { Alert, Avatar, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import {
  attendanceOn, candidatesFor, playersOf, sportById, testsOf, turnout,
} from "@/lib/sports";
import {
  SPECIAL_LEVEL_LABEL, SPECIAL_LEVEL_TONE, SPORT_TABS, tabOf,
} from "@/lib/sports-meta";
import {
  AddPlayers, NewSportTest, PauseSport, RemarkField, RemovePlayer, SportAttendance, TalentRow,
} from "../SportForms";

export default async function SportPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const user = await requireFeature("sports");
  const { id } = await params;
  const sp = await searchParams;
  const sport = await sportById(Number(id));
  if (!sport || !canTouchCenter(user, sport.center_id)) notFound();

  const session = await currentSession();
  if (!session) return <Alert kind="warn">No academic session is open.</Alert>;

  const tab = tabOf(sp.tab);
  const date = sp.date && sp.date <= today() ? sp.date : today();
  const players = await playersOf(sport.id, session.id);

  const [candidates, saved, tests, seen] = await Promise.all([
    tab === "players" ? candidatesFor(sport.id, sport.center_id, session.id) : Promise.resolve([]),
    tab === "attendance" ? attendanceOn(sport.id, date) : Promise.resolve({} as Record<number, string>),
    tab === "tests" ? testsOf(sport.id) : Promise.resolve([]),
    tab === "talent" || tab === "players" ? turnout(sport.id) : Promise.resolve({}),
  ]);
  const name = (p: { first_name: string; last_name: string | null }) =>
    `${p.first_name} ${p.last_name ?? ""}`.trim();
  const rate = (sid: number) => {
    const t = (seen as Record<number, { present: number; marked: number }>)[sid];
    return t && t.marked ? `${Math.round((t.present / t.marked) * 100)}%` : "—";
  };

  return (
    <>
      <Link href={`/sports?center=${sport.center_id}`}
        className="mb-2 inline-block text-[13px] text-[var(--muted)] hover:underline">
        ← {sport.center_code} · {sport.center_name}
      </Link>
      <PageHeader title={sport.name}
        subtitle={`${players.length} playing · ${players.filter((p) => p.is_special).length} marked as talented`
          + (sport.description ? ` · ${sport.description}` : "")} />

      {!sport.is_active && (
        <div className="mb-4"><Alert kind="warn">This sport is paused. Restart it to take attendance again.</Alert></div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {SPORT_TABS.map((t) => (
            <Link key={t.value} href={`/sports/${sport.id}?tab=${t.value}`}
              className={`btn btn-sm ${tab === t.value ? "btn-primary" : "btn-ghost"}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <PauseSport sportId={sport.id} active={sport.is_active} />
      </div>

      {tab === "players" && players.length === 0 && (
        <div className="grid gap-4">
          <p className="text-[13.5px] text-[var(--muted)]">
            Nobody is playing {sport.name} yet. Tick the children below who are joining, then press
            <strong> Add to the sport</strong>. You can then take their attendance and tests.
          </p>
          <AddPlayers sportId={sport.id} candidates={candidates} />
        </div>
      )}

      {tab === "players" && players.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card pad={false}>
              {players.length === 0 ? (
                <Empty title="Nobody is playing yet" hint="Add the children who are joining." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr><th>Child</th><th>Class</th><th>Turnout</th><th>Talent</th><th>Remark</th><th></th></tr>
                    </thead>
                    <tbody>
                      {players.map((p) => (
                        <tr key={p.student_id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={name(p)} size={28} />
                              <div className="min-w-0">
                                <div className="truncate font-medium">{name(p)}</div>
                                <div className="font-mono text-[11px] text-[var(--faint)]">{p.enrollment_no}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-[var(--muted)]">
                            {p.class_name ?? "—"}
                            <div className="text-[11px] text-[var(--faint)]">joined {fmtDate(p.joined_on)}</div>
                          </td>
                          <td>{rate(p.student_id)}</td>
                          <td>
                            {p.is_special
                              ? <Badge tone={SPECIAL_LEVEL_TONE[p.special_level ?? "centre"]}>{p.speciality}</Badge>
                              : <span className="text-[var(--faint)]">—</span>}
                          </td>
                          <td>
                            <RemarkField sportId={sport.id} studentId={p.student_id} remarks={p.remarks} />
                            {p.remarks_on && (
                              <div className="mt-0.5 text-[11px] text-[var(--faint)]">updated {fmtDate(p.remarks_on)}</div>
                            )}
                          </td>
                          <td><RemovePlayer sportId={sport.id} studentId={p.student_id} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
          <div className="lg:col-span-2">
            <AddPlayers sportId={sport.id} candidates={candidates} />
          </div>
        </div>
      )}

      {tab === "attendance" && (
        players.length === 0
          ? <Card pad={false}><Empty title="Nobody to mark" hint="Add players first, on the Players tab." /></Card>
          : <SportAttendance key={date} sportId={sport.id} date={date} players={players} saved={saved} />
      )}

      {tab === "tests" && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card pad={false}>
              {tests.length === 0 ? (
                <Empty title="No tests yet" hint="Set one up, then enter each child's marks and a remark." />
              ) : (
                <table className="tbl">
                  <thead><tr><th>Test</th><th>Date</th><th>Out of</th><th>Marked</th><th>Average</th></tr></thead>
                  <tbody>
                    {tests.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link href={`/sports/${sport.id}/tests/${t.id}`}
                            className="font-medium hover:text-[var(--brand)] hover:underline">
                            {t.title}
                          </Link>
                        </td>
                        <td className="text-[var(--muted)]">{fmtDate(t.test_date)}</td>
                        <td>{Number(t.max_marks)}</td>
                        <td>{t.marked} of {players.length}</td>
                        <td>{t.average ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
          <div className="lg:col-span-2"><NewSportTest sportId={sport.id} /></div>
        </div>
      )}

      {tab === "talent" && (
        <Card>
          <h2 className="mb-1 text-[15px] font-semibold">Children with a gift for {sport.name}</h2>
          <p className="mb-4 text-[13px] text-[var(--muted)]">
            Mark a child whose ability goes beyond the rest, say what it is, and how far you think
            it could take them. The office sees this list in its reports.
          </p>
          {players.length === 0 ? (
            <Empty title="Nobody to mark" hint="Add players first, on the Players tab." />
          ) : (
            <div className="divide-y divide-[#f1f1f6]">
              {players.map((p) => (
                <div key={p.student_id} className="py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-medium">{name(p)}</span>
                    <span className="text-[12px] text-[var(--muted)]">
                      {p.class_name ?? "—"} · turnout {rate(p.student_id)}
                    </span>
                    {p.is_special && p.special_level && (
                      <Badge tone={SPECIAL_LEVEL_TONE[p.special_level]}>
                        {SPECIAL_LEVEL_LABEL[p.special_level]}
                      </Badge>
                    )}
                  </div>
                  <TalentRow sportId={sport.id} player={p} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}
