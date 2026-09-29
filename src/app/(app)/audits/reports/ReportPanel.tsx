"use client";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { BAND_LABEL, OVERALL_LABEL, VISIT_KIND_LABEL } from "@/lib/audit-meta";
import { loadReport } from "./actions";

type Loaded = Awaited<ReturnType<typeof loadReport>>;

const BAND_TONE: Record<number, string> = {
  4: "ok", 3: "info", 2: "warn", 1: "bad", 0: "mute",
};

/**
 * The form as the auditor filled it: every check with its band, the reason
 * for a low one and whatever was written beside it, then what was asked of
 * the centre. Fetched when a row is opened, so a month of reports costs
 * nothing until somebody reads one.
 */
export default function ReportPanel({ visitId, onClose }:
  { visitId: number; onClose: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [, start] = useTransition();

  useEffect(() => { start(async () => setData(await loadReport(visitId))); }, [visitId]);
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

  const visit = data && "visit" in data ? data.visit : null;
  const ratings = data && "ratings" in data ? data.ratings : [];
  const suggestions = data && "suggestions" in data ? data.suggestions : [];

  // the checks come back in the order the form asks them; keep the sections
  const sections = ratings.reduce<Record<string, typeof ratings>>((g, r) => {
    (g[r.section] ??= []).push(r);
    return g;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
      bg-black/40 p-4 backdrop-blur-[1px]" onClick={onClose}>
      <div className="my-6 w-full max-w-[780px] rounded-[14px] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sticky top-0 flex flex-wrap items-start gap-3 rounded-t-[14px]
          border-b border-[var(--border)] bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">
              {visit ? visit.center_name : "Loading…"}
            </div>
            {visit && (
              <div className="mt-0.5 text-[13px] text-[var(--muted)]">
                {fmtDate(visit.visited_on)} · {VISIT_KIND_LABEL[visit.kind as "scheduled"] ?? visit.kind}
                {visit.auditor_name ? ` · ${visit.auditor_name}` : ""}
                {visit.submitted_at ? ` · filed ${visit.submitted_at.slice(11)}` : ""}
              </div>
            )}
          </div>
          {visit && (
            <div className="flex flex-none items-center gap-2">
              {visit.score_pct != null && (
                <span className="text-[15px] font-semibold tabular-nums">
                  {Math.round(Number(visit.score_pct))}%
                </span>
              )}
              {visit.overall && (
                <Badge tone={visit.overall === "healthy" ? "ok"
                  : visit.overall === "attention" ? "info"
                  : visit.overall === "support" ? "warn" : "bad"}>
                  {OVERALL_LABEL[visit.overall as "healthy"] ?? visit.overall}
                </Badge>
              )}
            </div>
          )}
          <button type="button" onClick={onClose}
            className="rounded-md px-2 py-1 text-[13px] text-[var(--muted)] hover:bg-[#f1f1f8]">
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {!data ? (
            <p className="text-[13px] text-[var(--muted)]">Fetching the report…</p>
          ) : "error" in data && data.error ? (
            <p className="text-[13px] text-[var(--bad)]">{data.error}</p>
          ) : (
            <>
              {visit && (visit.children_present != null || visit.staff_present != null) && (
                <section className="flex flex-wrap gap-x-6 gap-y-1 text-[13.5px]">
                  {visit.children_present != null && (
                    <span><b>{visit.children_present}</b>
                      <span className="text-[var(--muted)]">
                        {visit.children_on_roll ? ` of ${visit.children_on_roll}` : ""} children present
                      </span></span>
                  )}
                  {visit.staff_present != null && (
                    <span><b>{visit.staff_present}</b>
                      <span className="text-[var(--muted)]">
                        {visit.staff_on_roll ? ` of ${visit.staff_on_roll}` : ""} staff present
                      </span></span>
                  )}
                </section>
              )}

              {visit?.summary && (
                <section>
                  <div className="label-cap mb-1.5">What the auditor wrote</div>
                  <p className="text-[13.5px]">{visit.summary}</p>
                </section>
              )}

              <section>
                <div className="label-cap mb-2">The form, check by check</div>
                {ratings.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    No checks were recorded against this visit.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(sections).map(([section, list]) => (
                      <div key={section}>
                        <div className="mb-1.5 text-[12px] uppercase tracking-[0.06em]
                          text-[var(--faint)]">{section}</div>
                        <ul className="space-y-1.5">
                          {list.map((r) => (
                            <li key={r.id}
                              className="rounded-[9px] border border-[var(--border)] px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[13.5px] font-medium">{r.criterion_title}</span>
                                <span className="ml-auto">
                                  <Badge tone={BAND_TONE[r.band] ?? "mute"}>
                                    {BAND_LABEL[r.band] ?? r.band}
                                  </Badge>
                                </span>
                              </div>
                              {r.reason && (
                                <div className="mt-0.5 text-[12.5px] text-[#b45309]">{r.reason}</div>
                              )}
                              {r.note && (
                                <div className="mt-0.5 text-[13px] text-[var(--muted)]">{r.note}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {suggestions.length > 0 && (
                <section>
                  <div className="label-cap mb-2">What was asked of the centre</div>
                  <ul className="space-y-1.5">
                    {suggestions.map((s) => (
                      <li key={s.id}
                        className="rounded-[9px] border border-[var(--border)] px-3 py-2 text-[13.5px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.title}</span>
                          <Badge tone={s.priority === "critical" ? "bad"
                            : s.priority === "high" ? "warn" : "mute"}>
                            {s.priority}
                          </Badge>
                          <span className="ml-auto text-[12px] text-[var(--muted)]">{s.status}</span>
                        </div>
                        {s.detail && (
                          <p className="mt-0.5 text-[13px] text-[var(--muted)]">{s.detail}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
