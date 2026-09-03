import Link from "next/link";
import { Badge, Card, Empty, Meter } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export type CentreDay = {
  center_id: number;
  center_name: string;
  center_code: string;
  roll: number;          // children on the roll today
  marked: number;        // register rows for today
  present: number;       // present, late or half day
  absent: number;
  staff: number;         // staff who belong to the centre
  staff_in: number;      // staff who checked in today
  staff_late: number;
};

/**
 * Today, centre by centre — the one screen an administrator wants first thing:
 * whose register is not in yet, and who has not turned up.
 */
export default function DailyByCentre({ day, rows }:
  { day: string; rows: CentreDay[] }) {
  const total = rows.reduce((a, r) => ({
    roll: a.roll + r.roll, marked: a.marked + r.marked, present: a.present + r.present,
    staff: a.staff + r.staff, staff_in: a.staff_in + r.staff_in,
  }), { roll: 0, marked: 0, present: 0, staff: 0, staff_in: 0 });

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold">Today, centre by centre</h2>
          <p className="text-[13px] text-[var(--muted)]">
            {fmtDate(day)} · {total.present} of {total.marked} children present
            {total.marked < total.roll && (
              <span className="text-[var(--warn)]">
                {" "}· {total.roll - total.marked} not yet marked
              </span>
            )}
            {" "}· {total.staff_in} of {total.staff} staff checked in
          </p>
        </div>
        <Link href="/reports?report=student-attendance-trend&groupBy=day"
          className="text-[13px] text-[var(--brand)] hover:underline">
          Attendance over time →
        </Link>
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing recorded today"
          hint="Centre registers appear here as teachers mark them." />
      ) : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Centre</th><th>On roll</th><th>Register</th>
                <th>Present</th><th>Absent</th><th>Attendance</th><th>Staff in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const done = r.marked >= r.roll && r.roll > 0;
                return (
                  <tr key={r.center_id}>
                    <td className="font-medium">{r.center_name}</td>
                    <td className="tabular-nums text-[var(--muted)]">{r.roll}</td>
                    <td>
                      {r.roll === 0
                        ? <span className="text-[var(--faint)]">—</span>
                        : done
                          ? <Badge tone="ok">Complete</Badge>
                          : r.marked === 0
                            ? <Badge tone="bad">Not started</Badge>
                            : <Badge tone="warn">{r.marked}/{r.roll}</Badge>}
                    </td>
                    <td className="tabular-nums">{r.present}</td>
                    <td className="tabular-nums">{r.absent}</td>
                    <td>
                      {r.marked === 0
                        ? <span className="text-[var(--faint)]">—</span>
                        : <Meter value={pct(r.present, r.marked)} />}
                    </td>
                    <td className="whitespace-nowrap tabular-nums">
                      {r.staff === 0
                        ? <span className="text-[var(--faint)]">—</span>
                        : <>
                            {r.staff_in}/{r.staff}
                            {r.staff_late > 0 && (
                              <span className="ml-1.5 text-[12px] text-[var(--warn)]">
                                {r.staff_late} late
                              </span>
                            )}
                          </>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
