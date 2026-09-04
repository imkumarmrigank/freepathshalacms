import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { centersForUser, resolveCenterId } from "@/lib/queries";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { eventsBetween } from "@/lib/calendar";
import { weekOffDays } from "@/lib/attendance";
import { describeWeekOff } from "@/lib/week";
import { EVENT_LABEL, EVENT_TONE } from "@/lib/calendar-meta";
import { fmtDate, today } from "@/lib/format";
import MonthGrid from "./MonthGrid";
import EventForm from "./EventForm";
import DeleteEvent from "./DeleteEvent";
import KeepOpen from "./KeepOpen";
import { canPostToAllCentres, isGlobalRole, isTeaching } from "@/lib/roles";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
    label: new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN",
      { month: "long", year: "numeric", timeZone: "UTC" }),
    prev: m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`,
    next: m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`,
  };
}

export default async function CalendarPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const centers = await centersForUser(user);
  const centerId = resolveCenterId(user, sp.center);

  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today().slice(0, 7);
  const { from, to, label, prev, next } = monthBounds(month);

  const [monthEvents, upcoming, weekOff] = await Promise.all([
    eventsBetween(from, to, centerId),
    eventsBetween(today(), `${Number(today().slice(0, 4)) + 1}-12-31`, centerId),
    weekOffDays(),
  ]);

  const canEdit = !isTeaching(user.role);
  const keep = (m: string) =>
    `/calendar?month=${m}${sp.center ? `&center=${sp.center}` : ""}`;

  return (
    <>
      <PageHeader
        title="School calendar"
        subtitle={isGlobalRole(user.role) && !centerId
          ? "Holidays, PTM days, exams and events across all centres"
          : `Holidays, PTM days, exams and events at ${user.centerName ?? "this centre"}`}
        right={
          <div className="flex items-center gap-2">
            <Link href={keep(prev)} className="btn btn-ghost btn-sm">←</Link>
            <span className="min-w-[130px] text-center text-[14px] font-medium">{label}</span>
            <Link href={keep(next)} className="btn btn-ghost btn-sm">→</Link>
          </div>
        }
      />

      {isGlobalRole(user.role) && centers.length > 0 && (
        <form className="mb-4 flex items-end gap-2">
          <input type="hidden" name="month" value={month} />
          <label>
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--muted)]">Centre</span>
            <select className="select w-auto" name="center" defaultValue={sp.center ?? ""}>
              <option value="">All centres</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </label>
          <button className="btn btn-ghost mb-[1px] h-[38px]" type="submit">Show</button>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card pad={false} className="p-1.5">
            <MonthGrid month={month} events={monthEvents} today={today()} weekOff={weekOff} />
            <p className="px-2 py-2 text-[12px] text-[var(--muted)]">
              {describeWeekOff(weekOff)} every week, at every centre
              {user.role === "super_admin" && (
                <> — <Link href="/manage/working-days" className="text-[var(--brand)] hover:underline">
                  change the working week
                </Link></>
              )}.
            </p>
          </Card>

          <Card pad={false}>
            <h2 className="px-5 pb-3 pt-5 text-[15px] font-semibold">Coming up</h2>
            {upcoming.length === 0 ? (
              <Empty title="Nothing scheduled"
                hint={canEdit ? "Add holidays, PTM days and events using the form."
                  : "Your centre manager will publish holidays and events here."} />
            ) : (
              <ul>
                {upcoming.slice(0, 25).map((e) => (
                  <li key={`${e.source}-${e.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#f1f1f6] px-5 py-3">
                    <div className="w-[104px] flex-none text-[13px] font-medium">
                      {fmtDate(e.start_date)}
                      {e.end_date !== e.start_date && (
                        <div className="text-[12px] font-normal text-[var(--muted)]">
                          to {fmtDate(e.end_date)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{e.title}</div>
                      <div className="truncate text-[12px] text-[var(--muted)]">
                        {e.center_name ?? "All centres"}
                        {!e.is_all_day && e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ""}
                        {e.description ? ` · ${e.description}` : ""}
                      </div>
                    </div>
                    <Badge tone={EVENT_TONE[e.event_type]}>
                      {EVENT_LABEL[e.event_type] ?? e.event_type}
                    </Badge>
                    {canEdit && e.source === "calendar"
                      && (e.center_id !== null || canPostToAllCentres(user.role)) && (
                      <DeleteEvent id={e.id} />
                    )}
                    {e.source === "ptm" && (
                      <Link href="/ptm/meetings" className="btn btn-ghost btn-sm">Open</Link>
                    )}
                    {canEdit && e.source === "calendar" && e.center_id === null
                      && e.affects_attendance && (
                      <KeepOpen eventId={e.id} centres={centers}
                        openCentres={e.open_centres ?? []} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {canEdit && (
          <EventForm centers={centers} isAdmin={isGlobalRole(user.role)}
            allowAllCentres={canPostToAllCentres(user.role)}
            centerName={user.centerName} defaultDate={today()} />
        )}
      </div>
    </>
  );
}
