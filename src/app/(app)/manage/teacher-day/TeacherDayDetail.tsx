"use client";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { loadTeacherDay } from "./actions";

type Detail = Awaited<ReturnType<typeof loadTeacherDay>>;

/**
 * A teacher's day, whole: when they were at the centre, what the register
 * came to class by class, why each child was away, and what the teacher
 * wrote about the lesson.
 */
export default function TeacherDayDetail({ day, personId, person, onClose }: {
  day: string; personId: number; person: string; onClose: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [, start] = useTransition();

  useEffect(() => { start(async () => setData(await loadTeacherDay(day, personId))); },
    [day, personId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const punch = data?.punch ?? null;
  const byClass = data?.byClass ?? [];
  const reasons = data?.reasons ?? [];
  const notes = data?.notes ?? [];
  const present = byClass.reduce((n, c) => n + c.present, 0);
  const absent = byClass.reduce((n, c) => n + c.absent, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[760px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-center gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{person}</div>
            <div className="mt-0.5 text-[13px] text-[var(--muted)]">
              {fmtDate(day)}{punch?.center_name ? ` · ${punch.center_name}` : ""}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-md px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[#f1f1f8]">
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {!data ? (
            <p className="text-[13px] text-[var(--muted)]">Fetching the day…</p>
          ) : (
            <>
              {/* ------------------------------------------------ the punch */}
              <section>
                <div className="label-cap mb-2">At the centre</div>
                {!punch?.check_in ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    No check-in on this day.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px]">
                    <span><b>{punch.check_in}</b> in</span>
                    <span><b>{punch.check_out ?? "—"}</b> out</span>
                    {punch.minutes != null && (
                      <span className="text-[var(--muted)]">
                        {Math.floor(punch.minutes / 60)}h {punch.minutes % 60}m
                      </span>
                    )}
                    {punch.by_hand
                      ? <Badge tone="warn">Manual entry</Badge>
                      : punch.distance_m != null && (
                        <span className="text-[var(--muted)]">{punch.distance_m} m from centre</span>
                      )}
                    {punch.status && <Badge tone={punch.status === "late" ? "warn" : "ok"}>
                      {punch.status}
                    </Badge>}
                  </div>
                )}
                {punch?.away_reason && (
                  <p className="mt-1 text-[13px] text-[#b45309]">{punch.away_reason}</p>
                )}
                {punch?.spells && punch.spells.length > 1 && (
                  <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                    {punch.spells.map((s, i) =>
                      `${i + 1}. ${s.in} → ${s.out ?? "still in"}`).join("  ·  ")}
                  </p>
                )}
              </section>

              {/* -------------------------------------------- the register */}
              <section>
                <div className="label-cap mb-2">
                  The register · {present} present, {absent} absent
                </div>
                {byClass.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    This teacher marked no register on this day.
                  </p>
                ) : (
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
                          <td className="whitespace-nowrap text-[var(--muted)]">
                            {c.marked_at ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* ---------------------------------------- why they were away */}
              {reasons.length > 0 && (
                <section>
                  <div className="label-cap mb-2">Why children were away</div>
                  <ul className="space-y-1.5">
                    {reasons.map((r, i) => (
                      <li key={i} className="text-[13px]">
                        <span className="font-medium">{r.reason}</span>
                        <span className="text-[var(--muted)]"> · {r.n}</span>
                        {r.children && (
                          <div className="text-[12.5px] text-[var(--muted)]">{r.children}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* ------------------------------------------ what they wrote */}
              <section>
                <div className="label-cap mb-2">What the teacher wrote</div>
                {notes.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    Nothing written up for this day.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((n) => (
                      <div key={n.id}
                        className="rounded-[10px] border border-[var(--border)] px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">{n.class_name ?? "The whole day"}</Badge>
                          {n.subject && (
                            <span className="text-[13px] text-[var(--muted)]">{n.subject}</span>
                          )}
                          <span className="ml-auto text-[12px] text-[var(--faint)]">
                            saved {n.updated_at}
                          </span>
                        </div>
                        <dl className="mt-2 space-y-1.5 text-[13.5px]">
                          {n.chapter && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Taught</dt>
                              <dd>{n.chapter}{n.chapter_detail ? ` — ${n.chapter_detail}` : ""}</dd></div>
                          )}
                          {n.homework && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Homework</dt>
                              <dd>{n.homework}{n.homework_detail ? ` — ${n.homework_detail}` : ""}</dd></div>
                          )}
                          {n.equipment && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Equipment used</dt>
                              <dd>{n.equipment}{n.equipment_result ? ` — ${n.equipment_result}` : ""}</dd></div>
                          )}
                          {n.extra_activity && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Beyond the class</dt>
                              <dd>{n.extra_activity}{n.extra_detail ? ` — ${n.extra_detail}` : ""}</dd></div>
                          )}
                          {n.other_work && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Also did</dt>
                              <dd>{n.other_work}</dd></div>
                          )}
                          {n.support_needed && (
                            <div><dt className="text-[12px] uppercase tracking-[0.06em] text-[var(--faint)]">Help needed</dt>
                              <dd className="text-[#b45309]">{n.support_needed}</dd></div>
                          )}
                        </dl>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
