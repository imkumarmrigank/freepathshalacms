import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { Card, Empty, PageHeader, StatCard } from "@/components/ui";
import Filters from "@/components/Filters";
import Pager from "@/components/Pager";
import { pageFrom, pageWindow, totalOf } from "@/lib/paginate";
import { fmtDate, today } from "@/lib/format";
import { centersForUser } from "@/lib/queries";
import { can, readsAllAuditReports } from "@/lib/roles";
import { filedReports } from "@/lib/audits";
import { outOfFive } from "@/lib/audit-meta";
import { getT } from "@/lib/i18n";
import ReportRows from "./ReportRows";

export const metadata = { title: "Audit reports · Pehchaan" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Every audit report an auditor has filed, day by day, with the form behind
 * each one a click away.
 *
 * The office and the mentors read every centre; a centre reads its own, and
 * only once the report is filed — a visit still being written is the
 * auditor's working copy, not a verdict.
 */
export default async function AuditReportsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  // A mentor reads filed reports for every centre without holding the audit
  // feature itself: they do not run visits, they read what the visits found.
  const user = await requireUser();
  const all = readsAllAuditReports(user.role);
  if (!all && !can(user.role, "auditReports")) redirect("/dashboard");
  const sp = await searchParams;

  const now = today();
  const from = sp.from || addDays(now, -89);
  const to = sp.to || now;
  const centerId = all ? (sp.center ? Number(sp.center) : null) : user.centerId;
  const pg = pageFrom(sp, 25);

  const t = await getT();
  const [rows, centers, auditors] = await Promise.all([
    filedReports(user, {
      centerId, from, to,
      auditorId: all && sp.who ? Number(sp.who) : null,
      limit: pg.size, offset: pg.offset,
    }),
    centersForUser(user),
    all
      ? query<{ id: number; name: string }>(
          `SELECT DISTINCT u.id, u.name FROM audit_visits v JOIN users u ON u.id = v.auditor_id
            WHERE v.status = 'submitted' AND NOT u.is_test ORDER BY u.name`)
      : Promise.resolve([]),
  ]);

  const total = totalOf(rows);
  const win = pageWindow(pg, rows.length, total);
  const scored = rows.filter((r) => r.score_pct != null);
  const average = scored.length
    ? Math.round(scored.reduce((n, r) => n + Number(r.score_pct), 0) / scored.length)
    : null;
  const urgent = rows.filter((r) => r.overall === "urgent" || r.overall === "support").length;
  const asks = rows.reduce((n, r) => n + r.suggestions, 0);

  return (
    <>
      <PageHeader title={t("Audit reports")}
        subtitle={`${all ? t("Every centre") : t("Your centre")} · `
          + `${fmtDate(from)} ${t("to")} ${fmtDate(to)}`}
        right={
          <div className="flex items-center gap-2">
            <Link href="/audits" className="btn btn-ghost btn-sm">{t("Visits & standing")}</Link>
            {can(user.role, "reports") && (
              <Link href="/reports?report=audit-reports" className="btn btn-ghost btn-sm">
                {t("Download")}
              </Link>
            )}
          </div>
        } />

      <Filters
        centers={all ? centers : []}
        current={sp}
        dates
        extra={auditors.length > 0
          ? [{ name: "who", label: "Every auditor",
              options: auditors.map((a) => ({ value: a.id, label: a.name })) }]
          : []}
      />
      <p className="mt-1.5 text-[12px] text-[var(--faint)]">
        {t("The dates are the days the centres were visited. Only filed reports appear here.")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Reports filed")} value={total}
          hint={t("on this page: {n}", { n: rows.length })} />
        <StatCard label={t("Average mark")}
          value={average == null ? "—" : `${outOfFive(average)?.toFixed(1)} / 5`}
          hint={average == null ? undefined
            : t("{n}% of the points these visits could score", { n: average })}
          tone={average == null ? "default" : average >= 75 ? "ok" : average >= 50 ? "warn" : "bad"} />
        <StatCard label={t("Needing help")} value={urgent}
          hint={t("support required or immediate")}
          tone={urgent > 0 ? "warn" : "ok"} />
        <StatCard label={t("Asks raised")} value={asks} hint={t("on the reports shown")} />
      </div>

      <Card className="mt-5" pad={false}>
        {rows.length === 0 ? (
          <Empty title={t("No reports in this period")}
            hint={t("A report appears here the moment the auditor files the visit.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t("Visited on")}</th>
                  {all && <th>{t("Centre")}</th>}
                  <th>{t("Auditor")}</th><th>{t("Visit")}</th><th>{t("Mark")}</th>
                  <th>{t("Verdict")}</th><th>{t("Children present")}</th>
                  <th>{t("Weakest checks")}</th><th>{t("Asks")}</th>
                </tr>
              </thead>
              <ReportRows rows={rows} showCentre={all} />
            </table>
          </div>
        )}
        <Pager page={pg.page} pages={win.pages} first={win.first} last={win.last}
          total={total} unit={t("report")} />
      </Card>
    </>
  );
}
