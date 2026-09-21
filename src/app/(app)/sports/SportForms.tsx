"use client";
import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPlayers, addSport, createSportTest, markSpeciality, removePlayer,
  saveSportAttendance, saveSportMarks, setSportActive,
} from "./actions";
import { Avatar, Card, Field } from "@/components/ui";
import { FormMessage, Submit } from "@/components/form";
import { today } from "@/lib/format";
import { SPECIAL_LEVELS, SUGGESTED_SPORTS, type Player } from "@/lib/sports-meta";

const nameOf = (p: { first_name: string; last_name: string | null }) =>
  `${p.first_name} ${p.last_name ?? ""}`.trim();

/* ------------------------------------------------------------ add a sport */

export function AddSportForm({ centerId, centreName }: { centerId: number; centreName: string }) {
  const [state, action] = useActionState(addSport, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Add a sport</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        It will be listed whenever {centreName} is chosen.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="center_id" value={centerId} />
        <Field label="Sport *">
          <input className="input" name="name" list="sport-suggestions" required
            placeholder="Kabaddi" maxLength={60} />
          <datalist id="sport-suggestions">
            {SUGGESTED_SPORTS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Notes" hint="When it is played, what the children need to bring">
          <input className="input" name="description" placeholder="Tuesdays and Fridays, 4 pm" />
        </Field>
        <Submit>Add sport</Submit>
      </form>
    </Card>
  );
}

export function PauseSport({ sportId, active }: { sportId: number; active: boolean }) {
  const [state, action] = useActionState(setSportActive, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="sport_id" value={sportId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button className="btn btn-ghost btn-sm" type="submit">
        {active ? "Pause this sport" : "Restart this sport"}
      </button>
      {state?.error && <span className="text-[12px] text-[var(--bad)]">{state.error}</span>}
    </form>
  );
}

/* ---------------------------------------------------------------- players */

type Candidate = {
  student_id: number; first_name: string; last_name: string | null;
  enrollment_no: string; class_name: string | null; gender: string | null;
};

export function AddPlayers({ sportId, candidates }: { sportId: number; candidates: Candidate[] }) {
  const [state, action] = useActionState(addPlayers, null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? candidates.filter((c) =>
          `${nameOf(c)} ${c.enrollment_no} ${c.class_name ?? ""}`.toLowerCase().includes(needle))
      : candidates;
  }, [q, candidates]);

  const toggle = (id: number) =>
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Add children to this sport</h2>
      <p className="mb-3 text-[13px] text-[var(--muted)]">
        Children on this centre&rsquo;s roll who are not playing yet.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="sport_id" value={sportId} />
        {[...picked].map((id) => <input key={id} type="hidden" name="student_id" value={id} />)}

        {candidates.length === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Every child at the centre is already playing.</p>
        ) : (
          <>
            <input className="input mb-2" placeholder="Search by name, class or enrolment no."
              value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--muted)]">
              <span>{picked.size} chosen</span>
              <button type="button" className="underline"
                onClick={() => setPicked(new Set(shown.map((c) => c.student_id)))}>
                Choose all {shown.length} shown
              </button>
            </div>
            <div className="mb-3 max-h-[320px] overflow-y-auto rounded-lg border border-[var(--border)]">
              {shown.map((c) => (
                <label key={c.student_id}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-[#f1f1f6] px-3 py-2 text-[13px] last:border-b-0">
                  <input type="checkbox" className="h-4 w-4" checked={picked.has(c.student_id)}
                    onChange={() => toggle(c.student_id)} />
                  <span className="min-w-0 flex-1 truncate font-medium">{nameOf(c)}</span>
                  <span className="text-[12px] text-[var(--muted)]">{c.class_name ?? "—"}</span>
                  <span className="font-mono text-[11px] text-[var(--faint)]">{c.enrollment_no}</span>
                </label>
              ))}
            </div>
            <Submit>Add {picked.size || ""} to the sport</Submit>
          </>
        )}
      </form>
    </Card>
  );
}

export function RemovePlayer({ sportId, studentId }: { sportId: number; studentId: number }) {
  const [, action] = useActionState(removePlayer, null);
  return (
    <form action={action}>
      <input type="hidden" name="sport_id" value={sportId} />
      <input type="hidden" name="student_id" value={studentId} />
      <button className="btn btn-ghost btn-sm" type="submit" title="Stopped playing">Remove</button>
    </form>
  );
}

/* ------------------------------------------------------------- attendance */

export function SportAttendance({
  sportId, date, players, saved,
}: { sportId: number; date: string; players: Player[]; saved: Record<number, string> }) {
  const [state, action] = useActionState(saveSportAttendance, null);
  const router = useRouter();
  // a day already marked opens as it was saved; a new day starts everyone present
  const [marks, setMarks] = useState<Record<number, string>>(() =>
    Object.fromEntries(players.map((p) => [p.student_id, saved[p.student_id] ?? "present"])));
  const present = Object.values(marks).filter((v) => v === "present").length;
  const already = Object.keys(saved).length;

  return (
    <form action={action}>
      <input type="hidden" name="sport_id" value={sportId} />
      <input type="hidden" name="att_date" value={date} />
      <FormMessage state={state} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-[var(--muted)]">Date</span>
            <input className="input w-auto py-1" type="date" value={date} max={today()}
              onChange={(e) => router.replace(`?tab=attendance&date=${e.target.value}`)} />
          </label>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span><span className="text-[var(--muted)]">Present</span> <strong>{present}</strong></span>
            <span><span className="text-[var(--muted)]">Absent</span> <strong>{players.length - present}</strong></span>
            {already > 0 && <span className="text-[12px] text-[var(--muted)]">already saved for this day</span>}
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setMarks(Object.fromEntries(players.map((p) => [p.student_id, "present"])))}>
              All present
            </button>
          </div>
        </div>
        <table className="tbl">
          <tbody>
            {players.map((p) => (
              <tr key={p.student_id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={nameOf(p)} size={28} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{nameOf(p)}</div>
                      <div className="text-[11px] text-[var(--faint)]">{p.class_name ?? "—"} · {p.enrollment_no}</div>
                    </div>
                  </div>
                </td>
                <td className="text-right">
                  <input type="hidden" name={`st_${p.student_id}`} value={marks[p.student_id]} />
                  <div className="inline-flex gap-1">
                    {[
                      { v: "present", l: "P", c: "var(--ok)" },
                      { v: "absent", l: "A", c: "var(--bad)" },
                    ].map((o) => {
                      const on = marks[p.student_id] === o.v;
                      return (
                        <button key={o.v} type="button" title={o.v === "present" ? "Present" : "Absent"}
                          onClick={() => setMarks((m) => ({ ...m, [p.student_id]: o.v }))}
                          className="h-8 min-w-8 rounded-lg border px-2 text-[12px] font-semibold"
                          style={on
                            ? { background: o.c, borderColor: o.c, color: "#fff" }
                            : { background: "#fff", borderColor: "var(--border-strong)", color: "var(--muted)" }}>
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><Submit>Save sports attendance</Submit></div>
    </form>
  );
}

/* ------------------------------------------------------------------ tests */

export function NewSportTest({ sportId }: { sportId: number }) {
  const [state, action] = useActionState(createSportTest, null);
  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold">Take a test</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Set it up here, then open it to enter every child&rsquo;s marks and a remark.
      </p>
      <form action={action}>
        <FormMessage state={state} />
        <input type="hidden" name="sport_id" value={sportId} />
        <Field label="Test *">
          <input className="input" name="title" required placeholder="50 m sprint" />
        </Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Date *">
            <input className="input" type="date" name="test_date" defaultValue={today()}
              max={today()} required />
          </Field>
          <Field label="Out of *">
            <input className="input" type="number" name="max_marks" min={1} max={1000}
              step="0.5" defaultValue={10} required />
          </Field>
        </div>
        <Submit>Set up the test</Submit>
      </form>
    </Card>
  );
}

export function SportMarksSheet({
  testId, max, players, saved,
}: {
  testId: number; max: number; players: Player[];
  saved: Record<number, { marks: string | null; is_absent: boolean; remarks: string | null }>;
}) {
  const [state, action] = useActionState(saveSportMarks, null);
  const [absent, setAbsent] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(players.map((p) => [p.student_id, Boolean(saved[p.student_id]?.is_absent)])));

  return (
    <form action={action}>
      <input type="hidden" name="test_id" value={testId} />
      <FormMessage state={state} />
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>Child</th><th className="w-[110px]">Marks / {max}</th><th className="w-[80px]">Absent</th><th>Remarks</th></tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = saved[p.student_id];
              return (
                <tr key={p.student_id}>
                  <td>
                    <input type="hidden" name="pid" value={p.student_id} />
                    <div className="font-medium">{nameOf(p)}</div>
                    <div className="text-[11px] text-[var(--faint)]">{p.class_name ?? "—"} · {p.enrollment_no}</div>
                  </td>
                  <td>
                    <input className="input py-1" type="number" name={`m_${p.student_id}`}
                      min={0} max={max} step="0.5" disabled={absent[p.student_id]}
                      defaultValue={s?.marks ?? ""} aria-label={`Marks for ${nameOf(p)}`} />
                  </td>
                  <td>
                    <input type="checkbox" className="h-4 w-4" name={`ab_${p.student_id}`}
                      checked={absent[p.student_id]}
                      onChange={(e) => setAbsent((a) => ({ ...a, [p.student_id]: e.target.checked }))} />
                  </td>
                  <td>
                    <input className="input py-1" name={`rm_${p.student_id}`}
                      defaultValue={s?.remarks ?? ""} placeholder="Quick off the mark, tires by the end"
                      aria-label={`Remarks for ${nameOf(p)}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><Submit>Save marks</Submit></div>
    </form>
  );
}

/* ----------------------------------------------------------------- talent */

export function TalentRow({ sportId, player }: { sportId: number; player: Player }) {
  const [state, action] = useActionState(markSpeciality, null);
  const [special, setSpecial] = useState(player.is_special);

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[auto_1fr_200px_auto] sm:items-center">
      <input type="hidden" name="sport_id" value={sportId} />
      <input type="hidden" name="student_id" value={player.student_id} />
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="is_special" className="h-4 w-4" checked={special}
          onChange={(e) => setSpecial(e.target.checked)} />
        <span>Special talent</span>
      </label>
      <input className="input py-1" name="speciality" disabled={!special}
        defaultValue={player.speciality ?? ""} placeholder="Fastest raider at the centre" />
      <select className="select py-1" name="special_level" disabled={!special}
        defaultValue={player.special_level ?? ""}>
        <option value="">How far could it go?</option>
        {SPECIAL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>
      <div className="flex items-center gap-2">
        <button className="btn btn-primary btn-sm" type="submit">Save</button>
        {state?.ok && <span className="text-[12px] text-[var(--ok)]">Saved</span>}
        {state?.error && <span className="text-[12px] text-[var(--bad)]">{state.error}</span>}
      </div>
    </form>
  );
}
