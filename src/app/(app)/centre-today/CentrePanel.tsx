"use client";
import { useEffect, useState, useTransition } from "react";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { BAND_LABEL, OVERALL_LABEL, PRIORITY_LABEL, VISIT_KIND_LABEL } from "@/lib/audit-meta";
import { engagementLabel, modeLabel, parentLabel, priorityLabel } from "@/lib/ptm-meta";
import { URGENCY_LABEL } from "@/lib/counselling-meta";
import type { AuditDetail, CentreCard, FlagDetail, MeetingDetail } from "@/lib/centre-today";
import { loadCentreDay } from "./actions";

type Loaded = Awaited<ReturnType<typeof loadCentreDay>>;

/**
 * One centre's day, person by person: when each of them was in, what they
 * did, and what they wrote up about it — teachers first, then whoever else
 * came to the centre that day.
 */
export default function CentrePanel({ centre, on, onClose }:
  { centre: CentreCard; on: string; onClose: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    start(async () => setData(await loadCentreDay(centre.id, on)));
  }, [centre.id, on]);

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

  const people = data && "people" in data ? data.people : [];
  const failed = data && "error" in data ? data.error : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[760px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-start gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">{centre.name}</div>
            <div className="mt-0.5 text-[13px] text-[var(--muted)]">
              {centre.code} · {fmtDate(on)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <Num n={centre.roll ? `${centre.present}/${centre.roll}` : "—"} of="children" />
            <Num n={`${centre.staff_in}/${centre.staff_on_roll}`} of="staff in" />
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>

        <div className="px-5 py-4">
          {data === null && <p className="text-[13px] text-[var(--muted)]">Loading…</p>}
          {failed && <p className="text-[13px] text-[var(--bad)]">{failed}</p>}
          {data !== null && !failed && people.length === 0 && (
            <p className="text-[13px] text-[var(--muted)]">
              Nobody checked in and nothing was recorded at this centre on this day.
            </p>
          )}

          {people.map((p) => (
            <div key={p.user_id}
              className="mb-3 rounded-[11px] border border-[var(--border)] p-3.5 last:mb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-[14px] font-semibold">{p.name}</span>
                  <span className="ml-2 text-[12px] text-[var(--muted)]">
                    {ROLE_LABEL[p.role as Role] ?? p.role}
                  </span>
                  <Confidence rows={p.meetings} />
                </div>
                <div className="text-[12.5px] text-[var(--muted)]">
                  {p.check_in
                    ? <>
                        {p.check_in}–{p.check_out ?? "still in"}
                        {p.minutes != null && ` · ${Math.floor(p.minutes / 60)}h ${p.minutes % 60}m`}
                        {p.by_hand && <span className="ml-1.5 text-[var(--warn)]">by hand</span>}
                        {p.distance_m != null && ` · ${p.distance_m} m out`}
                      </>
                    : <span className="text-[var(--faint)]">no check-in</span>}
                </div>
              </div>

              {p.did.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {p.did.map((d, i) => (
                    <li key={i} className="text-[13px] text-[var(--ink)]">· {d}</li>
                  ))}
                </ul>
              )}

              {p.wrote.length > 0 && (
                <div className="mt-2.5 rounded-[9px] bg-[#f7f7fb] px-3 py-2.5">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide
                    text-[var(--faint)]">
                    In their own words
                  </div>
                  {p.wrote.map((w, i) => (
                    <p key={i} className="text-[13px] leading-[1.5]">
                      <span className="text-[var(--muted)]">{w.label}:</span> {w.text}
                    </p>
                  ))}
                </div>
              )}

              {p.audits.map((a) => <Audit key={a.visit_id} a={a} />)}
              {p.meetings.length > 0 && <Meetings rows={p.meetings} />}
              {p.flagged.length > 0 && <Flagged rows={p.flagged} />}

              {p.did.length === 0 && p.wrote.length === 0 && p.audits.length === 0
                && p.meetings.length === 0 && p.flagged.length === 0 && (
                <p className="mt-2 text-[12.5px] text-[var(--faint)]">
                  Checked in, but nothing recorded against the day.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- the audit visit */

const BAND_TONE: Record<number, string> = { 2: "text-[#7a5a12]", 1: "text-[var(--bad)]" };

/**
 * The visit as the auditor filled it: how each section came out, every check
 * they marked weak or poor with the reason they gave, and what they asked the
 * centre to do.
 */
function Audit({ a }: { a: AuditDetail }) {
  const score = a.score_pct == null ? null : Math.round(Number(a.score_pct));
  return (
    <div className="mt-2.5 rounded-[9px] border border-[var(--border)] px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12.5px] font-semibold">
          {VISIT_KIND_LABEL[a.kind as "scheduled"] ?? a.kind}
          <span className="ml-2 font-normal text-[var(--muted)]">
            {a.status === "submitted" ? "filed" : a.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-[12.5px] text-[var(--muted)]">
          {score != null && <b className="text-[var(--ink)]">{score}%</b>}
          {a.overall && ` · ${OVERALL_LABEL[a.overall as "healthy"] ?? a.overall}`}
          {a.children_present != null
            && ` · ${a.children_present} of ${a.children_on_roll ?? "—"} children`}
          {a.staff_present != null
            && ` · ${a.staff_present} of ${a.staff_on_roll ?? "—"} staff`}
        </div>
      </div>

      {a.sections.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {a.sections.map((x) => (
            <span key={x.section}
              className="rounded-full bg-[#f1f1f8] px-2 py-[3px] text-[11.5px] text-[var(--muted)]">
              {x.section}
              <span className="ml-1.5 tabular-nums">
                {x.good + x.fair}<span className="text-[var(--faint)]">/{x.good + x.fair + x.weak}</span>
              </span>
              {x.weak > 0 && <span className="ml-1 text-[#7a5a12]">· {x.weak} weak</span>}
            </span>
          ))}
        </div>
      )}

      {a.weak.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {a.weak.map((w, i) => (
            <li key={i} className="text-[12.5px] leading-[1.5]">
              <span className="text-[var(--faint)]">{w.section} · </span>
              <b>{w.title}</b>
              <span className={`ml-1.5 ${BAND_TONE[w.band] ?? ""}`}>{BAND_LABEL[w.band]}</span>
              {w.reason && <span className="block text-[#7a5a12]">{w.reason}</span>}
              {w.note && <span className="block text-[var(--muted)]">{w.note}</span>}
            </li>
          ))}
        </ul>
      )}

      {a.asks.length > 0 && (
        <div className="mt-2.5 border-t border-[var(--border)] pt-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Asked of the centre
          </div>
          <ul className="space-y-1">
            {a.asks.map((k) => (
              <li key={k.id} className="text-[12.5px] leading-[1.5]">
                <b>{k.title}</b>
                <span className="ml-1.5 text-[var(--muted)]">
                  {PRIORITY_LABEL[k.priority as "high"] ?? k.priority}
                  {k.due_on && ` · by ${fmtDate(k.due_on)}`}
                  {` · ${k.status.replace(/_/g, " ")}`}
                </span>
                {k.detail && <span className="block text-[var(--muted)]">{k.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.summary && (
        <p className="mt-2 border-t border-[var(--border)] pt-2 text-[12.5px] leading-[1.5]">
          <span className="text-[var(--muted)]">In the auditor&rsquo;s words:</span> {a.summary}
        </p>
      )}
    </div>
  );
}

/**
 * How the mentor left the day: the confidence they put on each child,
 * averaged. One child at 2 and one at 5 is a different day from two at 3,
 * so the spread is named too.
 */
function Confidence({ rows }: { rows: MeetingDetail[] }) {
  const scored = rows.filter((r) => r.confidence != null).map((r) => r.confidence as number);
  if (scored.length === 0) return null;
  const avg = scored.reduce((n, c) => n + c, 0) / scored.length;
  const low = Math.min(...scored);
  const high = Math.max(...scored);
  const tone = avg >= 4 ? "bg-[#eef7ee] text-[var(--ok)]"
    : avg >= 3 ? "bg-[var(--brand-soft)] text-[var(--brand)]"
    : "bg-[#fdf6e3] text-[#7a5a12]";
  return (
    <span className={`ml-2 rounded-full px-2 py-[2px] text-[11.5px] ${tone}`}
      title={`The mentor scored their confidence in each child out of 5. `
        + `Averaged over ${scored.length} of ${rows.length} meeting`
        + `${rows.length === 1 ? "" : "s"}`
        + (low !== high
          ? `, the lowest child was ${low} and the highest ${high}.`
          : `, every child was scored ${low}.`)}>
      confidence {avg.toFixed(1)}/5
      {low !== high && (
        <span className="opacity-70"> · lowest {low}, highest {high}</span>
      )}
    </span>
  );
}

/* ---------------------------------------------------------- the mentoring */

/** Every parent meeting the mentor held, child by child. */
function Meetings({ rows }: { rows: MeetingDetail[] }) {
  return (
    <div className="mt-2.5 rounded-[9px] border border-[var(--border)] px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        The meetings, child by child
      </div>
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id} className="text-[12.5px] leading-[1.5]">
            <b>{m.student}</b>
            <span className="text-[var(--muted)]">
              {m.class_name && ` · ${m.class_name}`}
              {` · ${m.parent_present === "none" || !m.parent_present
                ? "nobody came"
                : parentLabel(m.parent_present)}`}
              {m.mode && ` · ${modeLabel(m.mode)}`}
              {m.engagement && ` · ${engagementLabel(m.engagement)}`}
              {m.confidence != null && ` · confidence ${m.confidence}/5`}
              {m.attendance_pct != null && ` · ${Math.round(Number(m.attendance_pct))}% attendance`}
              {m.marks_pct != null && ` · ${Math.round(Number(m.marks_pct))}% marks`}
            </span>
            {(m.concern_tags?.length || m.commitment_tags?.length) && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {m.concern_tags?.map((t) => (
                  <span key={t} className="rounded-full bg-[#fdf6e3] px-2 py-[2px] text-[11px] text-[#7a5a12]">
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
                {m.commitment_tags?.map((t) => (
                  <span key={t} className="rounded-full bg-[#eef7ee] px-2 py-[2px] text-[11px] text-[var(--ok)]">
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </span>
            )}
            {m.discussion && <span className="block">{m.discussion}</span>}
            {m.concerns && (
              <span className="block text-[#7a5a12]">Concern: {m.concerns}</span>
            )}
            {m.action_items && (
              <span className="block text-[var(--muted)]">Agreed: {m.action_items}</span>
            )}
            {m.support_needed && (
              <span className="block text-[var(--muted)]">Needs: {m.support_needed}</span>
            )}
            {m.follow_up_required && (
              <span className="block text-[var(--brand)]">
                Follow up{m.follow_up_date && ` by ${fmtDate(m.follow_up_date)}`}
                {m.follow_up_priority && ` · ${priorityLabel(m.follow_up_priority)}`}
                {m.follow_up_assignee
                  ? ` · ${m.follow_up_assignee}`
                  : m.follow_up_owner && ` · ${m.follow_up_owner.replace(/_/g, " ")}`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The children this mentor put up for counselling on the day. */
function Flagged({ rows }: { rows: FlagDetail[] }) {
  return (
    <div className="mt-2.5 rounded-[9px] bg-[#fdf6e3] px-3 py-2.5">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#a07a1c]">
        Flagged for counselling
      </div>
      <ul className="space-y-1.5">
        {rows.map((f) => (
          <li key={f.id} className="text-[12.5px] leading-[1.5] text-[#7a5a12]">
            <b>{f.student}</b>
            {f.class_name && <span> · {f.class_name}</span>}
            <span> · {URGENCY_LABEL[f.urgency] ?? f.urgency}</span>
            {f.reasons?.length ? (
              <span> · {f.reasons.map((r) => r.replace(/_/g, " ")).join(", ")}</span>
            ) : null}
            {f.note && <span className="block">{f.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Num({ n, of }: { n: string; of: string }) {
  return (
    <div>
      <div className="text-[15px] font-semibold tabular-nums">{n}</div>
      <div className="text-[11.5px] text-[var(--muted)]">{of}</div>
    </div>
  );
}
