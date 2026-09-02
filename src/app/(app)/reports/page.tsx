import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { centersForUser, currentSession, listClasses, listSessions } from "@/lib/queries";
import { Alert, Card, Empty, PageHeader } from "@/components/ui";
import { REPORTS } from "@/lib/report-meta";
import { runReport, type ReportParams, type ReportResult } from "@/lib/reports";
import { IconDownload } from "@/components/icons";
import ReportPicker from "./ReportPicker";
import { isGlobalRole } from "@/lib/roles";

const PREVIEW_ROWS = 60;

export default async function ReportsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireFeature("reports");
  const sp = await searchParams;
  const [centers, classes, sessions, cur] = await Promise.all([
    centersForUser(user), listClasses(), listSessions(), currentSession(),
  ]);

  const available = REPORTS.filter((r) => !r.roles || r.roles.includes(user.role));
  const reportKey = sp.report && available.some((r) => r.key === sp.report)
    ? sp.report : available[0].key;

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const params: ReportParams = {
    from: sp.from || monthAgo.toISOString().slice(0, 10),
    to: sp.to || today,
    centerId: Number(sp.center) || null,
    classId: Number(sp.class) || null,
    sessionId: Number(sp.session) || cur?.id || sessions[0]?.id || 0,
    role: sp.role || null,
  };

  let result: ReportResult | null = null;
  let error: string | null = null;
  try {
    result = await runReport(reportKey, params, user);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not run this report.";
  }

  const qs = new URLSearchParams({
    report: reportKey,
    from: params.from,
    to: params.to,
    session: String(params.sessionId),
    ...(params.centerId ? { center: String(params.centerId) } : {}),
    ...(params.classId ? { class: String(params.classId) } : {}),
    ...(params.role ? { role: params.role } : {}),
  }).toString();

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Pick a report, set the period, and download it as Excel"
        right={
          result && result.rows.length > 0 ? (
            <>
              <Link href={`/api/reports/export?${qs}`} className="btn btn-primary" prefetch={false}>
                <IconDownload className="h-4 w-4" /> Download Excel
              </Link>
              <Link href={`/api/reports/export?${qs}&format=csv`} className="btn btn-ghost" prefetch={false}>
                CSV
              </Link>
            </>
          ) : undefined
        }
      />

      <ReportPicker
        available={available}
        centers={centers}
        classes={classes}
        sessions={sessions}
        showCenter={isGlobalRole(user.role)}
        current={{ ...sp, report: reportKey, from: params.from, to: params.to,
          session: String(params.sessionId) }}
      />

      {error && <Alert kind="bad">{error}</Alert>}

      {result && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">{result.title}</h2>
              <p className="text-[13px] text-[var(--muted)]">{result.subtitle}</p>
            </div>
            <span className="text-[13px] text-[var(--muted)]">
              {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
              {result.rows.length > PREVIEW_ROWS && ` · showing the first ${PREVIEW_ROWS}`}
            </span>
          </div>

          {result.rows.length === 0 ? (
            <Empty title="Nothing to show"
              hint="No records match these filters. Try a wider period or a different centre." />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c.key} className={c.numeric ? "text-right" : ""}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i}>
                      {result.columns.map((c) => (
                        <td key={c.key}
                          className={c.numeric ? "whitespace-nowrap text-right tabular-nums" : ""}>
                          {row[c.key] === null || row[c.key] === undefined || row[c.key] === ""
                            ? <span className="text-[var(--faint)]">—</span>
                            : String(row[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
