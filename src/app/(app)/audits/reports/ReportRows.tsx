"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { OVERALL_LABEL, VISIT_KIND_LABEL } from "@/lib/audit-meta";
import type { FiledVisit } from "@/lib/audits";
import Mark from "@/components/Mark";
import { useT } from "@/components/LocaleProvider";
import ReportPanel from "./ReportPanel";

/** A row is a filed report; opening it shows the form as it was filled. */
export default function ReportRows({ rows, showCentre }:
  { rows: FiledVisit[]; showCentre: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} tabIndex={0}
            onClick={() => setOpen(r.id)}
            onKeyDown={(e) => { if (e.key === "Enter") setOpen(r.id); }}
            title={t("Read the report")}
            className="cursor-pointer hover:bg-[#f7f7fb]">
            <td className="whitespace-nowrap font-medium">{fmtDate(r.visited_on)}</td>
            {showCentre && (
              <td>
                {r.center_name}
                <div className="text-[12px] text-[var(--muted)]">{r.center_code}</div>
              </td>
            )}
            <td className="text-[var(--muted)]">{r.auditor_name ?? "—"}</td>
            <td className="text-[var(--muted)]">
              {t(VISIT_KIND_LABEL[r.kind as "scheduled"] ?? r.kind)}
            </td>
            <td><Mark pct={r.score_pct} /></td>
            <td>
              {r.overall && (
                <Badge tone={r.overall === "healthy" ? "ok"
                  : r.overall === "attention" ? "info"
                  : r.overall === "support" ? "warn" : "bad"}>
                  {t(OVERALL_LABEL[r.overall as "healthy"] ?? r.overall)}
                </Badge>
              )}
            </td>
            <td className="tabular-nums text-[var(--muted)]">
              {r.children_present ?? "—"}
              {r.children_on_roll ? ` of ${r.children_on_roll}` : ""}
            </td>
            <td className="max-w-[280px] text-[13px] text-[var(--muted)]">
              {r.weakest ? t(r.weakest)
                : <span className="text-[var(--faint)]">{t("nothing marked weak")}</span>}
            </td>
            <td className="tabular-nums">{r.suggestions || "—"}</td>
          </tr>
        ))}
      </tbody>
      {open !== null && <ReportPanel visitId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
