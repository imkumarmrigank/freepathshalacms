import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { centersForUser, currentSession } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { holidaysBetween } from "@/lib/calendar";
import { EVENT_LABEL } from "@/lib/calendar-meta";
import { today } from "@/lib/format";
import { canSetHolidays } from "@/lib/roles";
import { getT } from "@/lib/i18n";
import HolidayForm from "./HolidayForm";
import HolidayRows from "./HolidayRows";

export const metadata = { title: "Holidays · Pehchaan" };

/** April to March, the year the session runs on. */
function yearBounds(year: number) {
  return { from: `${year}-04-01`, to: `${year + 1}-03-31`, label: `${year}–${String(year + 1).slice(2)}` };
}

/**
 * The holiday list.
 *
 * The calendar answers "what is on this month"; this answers "what are the
 * holidays this year, and which centres are working through them" — the list
 * the office keeps on paper, in one place, in date order.
 *
 * A holiday posted to every centre can be lifted for one centre without
 * touching the rest: that centre is recorded as working that day, and its
 * register opens as normal while everybody else's stays shut.
 */
export default async function HolidaysPage({
  searchParams,
}: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireUser();
  if (!canSetHolidays(user.role)) redirect("/dashboard?denied=1");
  const t = await getT();

  const sp = await searchParams;
  const now = today();
  // the school year turns over in April
  const thisYear = Number(now.slice(0, 4)) - (now.slice(5, 7) < "04" ? 1 : 0);
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : thisYear;
  const { from, to, label } = yearBounds(year);

  const [rows, centres, session] = await Promise.all([
    holidaysBetween(from, to, null),
    centersForUser(user),
    currentSession(),
  ]);

  const days = rows.reduce((n, r) => n + Number(r.days), 0);
  const upcoming = rows.filter((r) => r.end_date >= now).length;
  const withOverrides = rows.filter((r) => r.open_centres.length > 0).length;

  return (
    <>
      <PageHeader title={t("Holidays")}
        subtitle={t("The year {y} · every holiday and closure, in date order", { y: label })}
        right={
          <div className="flex items-center gap-2">
            <Link href={`/manage/holidays?year=${year - 1}`} className="btn btn-ghost btn-sm">
              ← {yearBounds(year - 1).label}
            </Link>
            <Link href={`/manage/holidays?year=${year + 1}`} className="btn btn-ghost btn-sm">
              {yearBounds(year + 1).label} →
            </Link>
            <Link href="/calendar" className="btn btn-ghost btn-sm">{t("Calendar")}</Link>
          </div>
        } />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Holidays listed")} value={rows.length} hint={label} />
        <StatCard label={t("Days off")} value={days}
          hint={t("counting every day of a run")} />
        <StatCard label={t("Still to come")} value={upcoming} hint={t("from today")} />
        <StatCard label={t("With a centre working")} value={withOverrides}
          tone={withOverrides > 0 ? "warn" : "default"}
          hint={t("a centre opens while the rest are shut")} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card pad={false}>
            {rows.length === 0 ? (
              <Empty title={t("No holidays listed for {y}", { y: label })}
                hint={t("Add them with the form beside this, and they apply to every centre "
                  + "unless you name one.")} />
            ) : (
              <HolidayRows rows={rows} centres={centres} />
            )}
          </Card>
          <p className="mt-2 text-[12.5px] text-[var(--muted)]">
            {t("A holiday closes the register for that day and stops the nightly "
              + "auto-absent. A centre marked as working keeps its register open.")}
          </p>
        </div>

        <div className="lg:col-span-2">
          <HolidayForm centres={centres} sessionLabel={session?.name ?? null}
            defaultDate={now > to ? to : now < from ? from : now} />
        </div>
      </div>

      {rows.some((r) => r.center_id !== null) && (
        <p className="mt-4 text-[12.5px] text-[var(--muted)]">
          {t("A holiday with a centre named beside it was posted for that centre only.")}
          {" "}
          <Badge tone="mute" dot={false}>{EVENT_LABEL.closure}</Badge>
          {" "}
          {t("means the centre is shut for a reason other than a holiday.")}
        </p>
      )}
    </>
  );
}
