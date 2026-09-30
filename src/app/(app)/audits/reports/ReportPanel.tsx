"use client";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import {
  BAND_LABEL, OVERALL_LABEL, PRIORITY_LABEL, SUGGESTION_STATUS_LABEL,
  VISIT_KIND_LABEL, bandPoints,
} from "@/lib/audit-meta";
import Mark from "@/components/Mark";
import { useLocale, useT } from "@/components/LocaleProvider";
import { loadReport } from "./actions";

type Loaded = Awaited<ReturnType<typeof loadReport>>;

const BAND_TONE: Record<number, string> = {
  4: "ok", 3: "info", 2: "warn", 1: "bad", 0: "mute",
};

/**
 * What the check was worth and what it earned. Not every check counts the
 * same — attendance carries three points where punctuality carries one — so
 * a band on its own does not say how much it moved the score.
 */
function Points({ band, weight }: { band: number; weight: number }) {
  const p = bandPoints(band, weight);
  if (!p) return null;
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <span className="text-[12px] tabular-nums text-[var(--muted)]"
      title={`This check is worth ${weight} of the score; the band chosen earns `
        + `${round(p.got)}.`}>
      {round(p.got)}/{p.of}
    </span>
  );
}

/**
 * The form as the auditor filled it: every check with its band, the reason
 * for a low one and whatever was written beside it, then what was asked of
 * the centre. Fetched when a row is opened, so a month of reports costs
 * nothing until somebody reads one.
 */
export default function ReportPanel({ visitId, onClose }:
  { visitId: number; onClose: () => void }) {
  const t = useT();
  // The audit form carries its own Hindi, written by whoever set the checks
  // up. That is better than a translation of it, so it wins when it exists.
  const hi = useLocale() === "hi";
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
    (g[(hi && r.section_hi) || r.section] ??= []).push(r);
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
              {visit ? visit.center_name : t("Loading…")}
            </div>
            {visit && (
              <div className="mt-0.5 text-[13px] text-[var(--muted)]">
                {fmtDate(visit.visited_on)} · {t(VISIT_KIND_LABEL[visit.kind as "scheduled"] ?? visit.kind)}
                {visit.auditor_name ? ` · ${visit.auditor_name}` : ""}
                {visit.submitted_at ? ` · filed ${visit.submitted_at.slice(11)}` : ""}
              </div>
            )}
          </div>
          {visit && (
            <div className="flex flex-none items-center gap-2">
              {visit.score_pct != null && <Mark pct={visit.score_pct} size="lg" />}
              {visit.overall && (
                <Badge tone={visit.overall === "healthy" ? "ok"
                  : visit.overall === "attention" ? "info"
                  : visit.overall === "support" ? "warn" : "bad"}>
                  {t(OVERALL_LABEL[visit.overall as "healthy"] ?? visit.overall)}
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
            <p className="text-[13px] text-[var(--muted)]">{t("Fetching the report…")}</p>
          ) : "error" in data && data.error ? (
            <p className="text-[13px] text-[var(--bad)]">{data.error}</p>
          ) : (
            <>
              {visit && (visit.children_present != null || visit.staff_present != null) && (
                <section className="flex flex-wrap gap-x-6 gap-y-1 text-[13.5px]">
                  {visit.children_present != null && (
                    <span><b>{visit.children_present}</b>
                      <span className="text-[var(--muted)]">
                        {visit.children_on_roll ? ` ${t("of {n}", { n: visit.children_on_roll })}` : ""}{" "}
                        {t("children present")}
                      </span></span>
                  )}
                  {visit.staff_present != null && (
                    <span><b>{visit.staff_present}</b>
                      <span className="text-[var(--muted)]">
                        {visit.staff_on_roll ? ` ${t("of {n}", { n: visit.staff_on_roll })}` : ""}{" "}
                        {t("staff present")}
                      </span></span>
                  )}
                </section>
              )}

              {visit?.summary && (
                <section>
                  <div className="label-cap mb-1.5">{t("What the auditor wrote")}</div>
                  <p className="text-[13.5px]">{visit.summary}</p>
                </section>
              )}

              <section>
                <div className="label-cap mb-2">{t("The form, check by check")}</div>
                {ratings.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    {t("No checks were recorded against this visit.")}
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
                                <span className="text-[13.5px] font-medium">
                                  {(hi && r.title_hi) || r.criterion_title}
                                </span>
                                <span className="ml-auto flex items-center gap-2">
                                  <Points band={r.band} weight={r.weight} />
                                  <Badge tone={BAND_TONE[r.band] ?? "mute"}>
                                    {t(BAND_LABEL[r.band] ?? String(r.band))}
                                  </Badge>
                                </span>
                              </div>
                              {/* what the auditor actually ticked, in the
                                  wording the form put in front of them */}
                              {r.chosen ? (
                                <div className="mt-1 text-[13px]">
                                  {hi && r.chosen_hi ? r.chosen_hi : r.chosen}
                                  {(hi ? r.chosen : r.chosen_hi) && (
                                    <span className="text-[var(--muted)]">
                                      {" · "}{hi ? r.chosen : r.chosen_hi}
                                    </span>
                                  )}
                                </div>
                              ) : r.band === 0 ? (
                                <div className="mt-1 text-[13px] text-[var(--muted)]">
                                  {t("Does not apply — left out of the score")}
                                </div>
                              ) : null}
                              {r.reason && (
                                <div className="mt-0.5 text-[12.5px] text-[#b45309]">
                                  {(hi && r.reason_hi) || r.reason}
                                </div>
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
                  <div className="label-cap mb-2">{t("What was asked of the centre")}</div>
                  <ul className="space-y-1.5">
                    {suggestions.map((s) => (
                      <li key={s.id}
                        className="rounded-[9px] border border-[var(--border)] px-3 py-2 text-[13.5px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.title}</span>
                          <Badge tone={s.priority === "critical" ? "bad"
                            : s.priority === "high" ? "warn" : "mute"}>
                            {t(PRIORITY_LABEL[s.priority as "high"] ?? s.priority)}
                          </Badge>
                          <span className="ml-auto text-[12px] text-[var(--muted)]">
                            {t(SUGGESTION_STATUS_LABEL[
                              s.status as keyof typeof SUGGESTION_STATUS_LABEL] ?? s.status)}
                          </span>
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
