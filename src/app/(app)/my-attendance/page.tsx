import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { Alert, Badge, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { fmtDate, minutesToHours, today, titleCase } from "@/lib/format";
import PunchCard from "./PunchCard";

const TONE: Record<string, string> = {
  present: "ok", late: "warn", absent: "bad", leave: "mute", holiday: "mute",
};

export default async function MyAttendancePage() {
  const user = await requireUser();
  if (!user.centerId)
    return <Alert kind="warn">You are not assigned to a centre, so check-in is unavailable.</Alert>;

  const center = await one<{
    name: string; latitude: number | null; longitude: number | null; geofence_radius_m: number;
  }>("SELECT name, latitude, longitude, geofence_radius_m FROM centers WHERE id = $1", [user.centerId]);

  const [todayRow, history, summary] = await Promise.all([
    one<{
      check_in_at: string | null; check_out_at: string | null;
      check_in_distance_m: number | null; status: string;
    }>(
      `SELECT check_in_at, check_out_at, check_in_distance_m, status
         FROM staff_attendance WHERE user_id = $1 AND att_date = $2`,
      [user.uid, today()],
    ),
    query<{
      att_date: string; check_in_at: string | null; check_out_at: string | null;
      worked_minutes: number | null; status: string; check_in_distance_m: number | null;
    }>(
      `SELECT att_date, check_in_at, check_out_at, worked_minutes, status, check_in_distance_m
         FROM staff_attendance WHERE user_id = $1
        ORDER BY att_date DESC LIMIT 30`,
      [user.uid],
    ),
    one<{ days: string; late: string; minutes: string }>(
      `SELECT count(*) FILTER (WHERE status IN ('present','late')) AS days,
              count(*) FILTER (WHERE status = 'late') AS late,
              COALESCE(sum(worked_minutes), 0) AS minutes
         FROM staff_attendance
        WHERE user_id = $1
          AND date_trunc('month', att_date) = date_trunc('month', CURRENT_DATE)`,
      [user.uid],
    ),
  ]);

  const time = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

  return (
    <>
      <PageHeader title="My attendance"
        subtitle={`Check in from inside ${center?.name ?? "your centre"} — your location is verified against the centre.`} />

      <PunchCard
        today={todayRow}
        centerName={center?.name ?? "your centre"}
        radius={center?.geofence_radius_m ?? 150}
        hasCoords={center?.latitude != null && center?.longitude != null}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Days present" value={summary?.days ?? 0} hint="this month" />
        <StatCard label="Late arrivals" value={summary?.late ?? 0} hint="this month"
          tone={Number(summary?.late ?? 0) > 0 ? "warn" : "default"} />
        <StatCard label="Hours logged" value={minutesToHours(Number(summary?.minutes ?? 0))} hint="this month" />
      </div>

      <div className="label-cap mb-2.5 mt-6">Recent days</div>
      <Card pad={false}>
        {history.length === 0 ? (
          <Empty title="No check-ins yet" hint="Your daily punches will be listed here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Distance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.att_date}>
                    <td className="font-medium">{fmtDate(h.att_date)}</td>
                    <td>{time(h.check_in_at)}</td>
                    <td>{time(h.check_out_at)}</td>
                    <td>{minutesToHours(h.worked_minutes)}</td>
                    <td className="text-[var(--muted)]">
                      {h.check_in_distance_m == null ? "—" : `${h.check_in_distance_m} m`}
                    </td>
                    <td><Badge tone={TONE[h.status]}>{titleCase(h.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
