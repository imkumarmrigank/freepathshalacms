import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { today } from "@/lib/format";
import { auditSettings, monthly } from "@/lib/audits";

export const metadata = { title: "Best centre · Pehchaan" };

const MONTH_NAME = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN",
    { month: "long", year: "numeric" });

/** The last twelve months, newest first, for the picker. */
function recentMonths(n = 12) {
  const out: string[] = [];
  const d = new Date(`${today()}T00:00:00`);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default async function BoardPage({
  searchParams,
}: { searchParams: Promise<{ month?: string }> }) {
  await requireFeature("auditReports");
  const sp = await searchParams;
  const months = recentMonths();
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : months[0];

  const [rows, set] = await Promise.all([monthly(month), auditSettings()]);
  const ranked = rows.filter((r) => r.score != null);
  const winner = ranked[0];

  return (
    <>
      <PageHeader
        title="Best centre"
        subtitle={`${MONTH_NAME(month)} — ${set.ratingWeightPct}% from how centres were found, ${
          100 - set.ratingWeightPct}% from acting on what was asked`}
        right={<Link href="/audits" className="btn btn-ghost">Back to audits</Link>}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {months.slice(0, 6).map((m) => (
          <Link key={m} href={`/audits/board?month=${m}`}
            className={`rounded-full px-3 py-1.5 text-[12.5px] ${
              m === month
                ? "bg-[var(--brand)] text-white"
                : "bg-[#f4f4f9] text-[var(--muted)] hover:bg-[#ececf3]"}`}>
            {MONTH_NAME(m)}
          </Link>
        ))}
      </div>

      {winner && (
        <Card className="mt-4">
          <div className="label-cap mb-1">Leading this month</div>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[22px] font-semibold">{winner.center_name}</span>
            <span className="text-[16px] tabular-nums text-[var(--muted)]">
              {winner.score?.toFixed(1)} points
            </span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {winner.visits} visit{winner.visits === 1 ? "" : "s"}
            {winner.rating != null && `, rated ${winner.rating.toFixed(0)}%`}
            {winner.closed > 0
              ? `, ${winner.closed} suggestion${winner.closed === 1 ? "" : "s"} confirmed done`
              : ", no suggestions confirmed yet"}
          </p>
        </Card>
      )}

      <Card className="mt-4" pad={false}>
        {rows.length === 0 ? (
          <Empty title="Nothing scored this month"
            hint="A centre appears here once an auditor files a report for it." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-[12px] uppercase tracking-[0.05em] text-[var(--faint)]">
                  <th className="px-5 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Centre</th>
                  <th className="px-3 py-2.5 text-right font-medium">Visits</th>
                  <th className="px-3 py-2.5 text-right font-medium">On the day</th>
                  <th className="px-3 py-2.5 text-right font-medium">Acted on</th>
                  <th className="px-5 py-2.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.center_id} className="border-t border-[#f1f1f6]">
                    <td className="px-5 py-2.5 tabular-nums text-[var(--faint)]">
                      {r.score == null ? "—" : i + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.center_name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.visits}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.rating == null ? "—" : `${r.rating.toFixed(0)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.action == null
                        ? <span className="text-[var(--faint)]">nothing due</span>
                        : `${r.action.toFixed(0)}%`}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                      {r.score == null ? "—" : r.score.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
        A centre is credited for a suggestion when the auditor confirms it was done,
        not when the centre says so — so the two halves of the score cannot be played
        off against each other. Work finished after the date the auditor set still
        earns {set.pointsLate} out of {set.pointsDoneWell}: late is not the same as never.
      </p>
    </>
  );
}
