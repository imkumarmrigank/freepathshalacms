import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Card, Empty, PageHeader } from "@/components/ui";
import { fmtDate, today } from "@/lib/format";
import { centreCards } from "@/lib/centre-today";
import DatePick from "./DatePick";
import CentreCards from "./CentreCards";

export const metadata = { title: "Centre today · Pehchaan" };

/**
 * One day across every centre, on cards — the register, who came in, and
 * what else happened there. Open a card and the day breaks down person by
 * person: what each teacher, mentor, auditor and sports teacher did.
 *
 * The office reads this; it is the whole organisation on one screen, so it
 * is not a page for a single centre's staff.
 */
export default async function CentreTodayPage({
  searchParams,
}: { searchParams: Promise<{ on?: string }> }) {
  const user = await requireUser();
  if (user.role !== "super_admin" && user.role !== "admin") redirect("/dashboard?denied=1");

  const sp = await searchParams;
  const now = today();
  const on = sp.on && /^\d{4}-\d{2}-\d{2}$/.test(sp.on) ? sp.on : now;
  const rows = await centreCards(on);

  const present = rows.reduce((n, r) => n + r.present, 0);
  const roll = rows.reduce((n, r) => n + r.roll, 0);
  const staffIn = rows.reduce((n, r) => n + r.staff_in, 0);
  const quiet = rows.filter((r) => r.roll === 0 && r.staff_in === 0).length;

  return (
    <>
      <PageHeader title="Centre today"
        subtitle={on === now
          ? `Today · ${fmtDate(on)}`
          : fmtDate(on)}
        right={<DatePick on={on} max={now} />} />

      <Card className="mb-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Fig n={rows.length} of={rows.length === 1 ? "centre open" : "centres open"} />
          <Fig n={present} of={roll ? `of ${roll} children present` : "children marked"} />
          <Fig n={staffIn} of="staff checked in" />
          <Fig n={quiet} of={quiet === 1 ? "centre with nothing yet" : "centres with nothing yet"}
            tone={quiet ? "warn" : undefined} />
        </div>
      </Card>

      {rows.length === 0 ? (
        <Empty title="No centres" hint="Add a centre before this page has anything to show." />
      ) : (
        <CentreCards rows={rows} on={on} />
      )}
    </>
  );
}

function Fig({ n, of, tone }: { n: number; of: string; tone?: "warn" }) {
  return (
    <div>
      <div className={`text-[22px] font-semibold tabular-nums ${tone === "warn" && n > 0 ? "text-[var(--warn)]" : ""}`}>
        {n}
      </div>
      <div className="text-[12.5px] text-[var(--muted)]">{of}</div>
    </div>
  );
}
