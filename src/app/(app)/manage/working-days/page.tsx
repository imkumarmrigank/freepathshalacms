import { requireRole } from "@/lib/auth";
import { weekOffDays } from "@/lib/attendance";
import { Card, PageHeader } from "@/components/ui";
import { describeWeekOff } from "@/lib/week";
import WeekForm from "./WeekForm";

export const metadata = { title: "Working days · Pehchaan" };

export default async function WorkingDaysPage() {
  await requireRole("super_admin");
  const off = await weekOffDays();

  return (
    <>
      <PageHeader title="Working days"
        subtitle="Which days of the week the centres run" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="mb-1 text-[15px] font-semibold">The teaching week</h2>
            <p className="mb-4 text-[13px] text-[var(--muted)]">
              Currently {describeWeekOff(off).toLowerCase()}. Untick a day to make it a
              weekly holiday everywhere.
            </p>
            <WeekForm off={off} />
          </Card>
        </div>

        <Card>
          <h2 className="mb-2 text-[15px] font-semibold">What this changes</h2>
          <ul className="space-y-2.5 text-[13px] text-[var(--muted)]">
            <li>
              A weekly holiday is drawn as a holiday on the school calendar, at every
              centre, without anyone adding it each week.
            </li>
            <li>
              The register does not close itself on those days, so nobody is
              auto-marked absent for a day the centre was shut.
            </li>
            <li>
              Attendance already recorded is left exactly as it is. Only days from
              here on are affected.
            </li>
            <li>
              A one-off holiday — a festival, a centre closure — still goes on the
              calendar as an event.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
