import "server-only";
import { query } from "./db";

export type Period = "month" | "quarter" | "year";

/**
 * A child imported from a sheet with no admission date was given the day of
 * the import instead. That is not when they were admitted, and counting it
 * would put a false peak in the month of the import, so they are left out of
 * the admissions trend — and the page says how many.
 */
const UNKNOWN_ADMISSION =
  "(COALESCE(notes, '') LIKE 'Imported%' AND admission_date = created_at::date)";
const KNOWN_ADMISSION = `NOT ${UNKNOWN_ADMISSION}`;

export async function unknownAdmissions(centerId: number | null) {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM students
      WHERE ${UNKNOWN_ADMISSION} ${centerId ? "AND center_id = $1" : ""}`,
    centerId ? [centerId] : []);
  return rows[0]?.n ?? 0;
}

export function periodOf(v: string | undefined): Period {
  return v === "quarter" || v === "year" ? v : "month";
}

export type TrendRow = {
  key: string;         // sortable: 2026-09, 2026-27-Q2, 2026-27
  label: string;       // what the axis shows
  admissions: number;
  marked: number;      // attendance marks that count (holidays excluded)
  present: number;     // present, late or half day
  ptms: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The academic year a month falls in: April 2026 – March 2027 is 2026-27. */
function academicYear(y: number, m: number) {
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Quarters of the academic year: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar. */
function academicQuarter(m: number) {
  return m >= 4 ? Math.floor((m - 4) / 3) + 1 : 4;
}

/**
 * Admissions, attendance and PTMs over time, for the whole organisation or one
 * centre. Built month by month over an unbroken run of months — a month with
 * nothing in it is a zero, not a missing bar — and then added up into
 * quarters or academic years.
 */
export async function trends(centerId: number | null, period: Period): Promise<TrendRow[]> {
  // how far back: two years of months, or everything (up to eight years) when
  // the months are gathered into quarters or years
  const back = period === "month" ? 23 : 95;
  const c = centerId ? "AND center_id = $1" : "";
  const params = centerId ? [centerId] : [];

  const months = await query<{
    y: number; m: number; admissions: number; marked: number; present: number; ptms: number;
  }>(
    `WITH first_month AS (
       SELECT GREATEST(
                date_trunc('month', CURRENT_DATE) - interval '${back} months',
                date_trunc('month', LEAST(
                  (SELECT min(admission_date) FROM students
                    WHERE admission_date IS NOT NULL ${c} AND ${KNOWN_ADMISSION}),
                  (SELECT min(att_date) FROM student_attendance WHERE TRUE ${c}),
                  (SELECT min(interaction_date) FROM ptm_interactions WHERE TRUE ${c}),
                  CURRENT_DATE))) AS m
     ),
     months AS (
       SELECT generate_series((SELECT m FROM first_month), date_trunc('month', CURRENT_DATE),
                              interval '1 month')::date AS m
     ),
     adm AS (
       SELECT date_trunc('month', admission_date)::date AS m, count(*)::int AS n
         FROM students WHERE admission_date IS NOT NULL ${c} AND ${KNOWN_ADMISSION}
        GROUP BY 1
     ),
     att AS (
       SELECT date_trunc('month', att_date)::date AS m,
              count(*) FILTER (WHERE status <> 'holiday')::int AS marked,
              count(*) FILTER (WHERE status IN ('present','late','half_day'))::int AS present
         FROM student_attendance WHERE TRUE ${c} GROUP BY 1
     ),
     ptm AS (
       SELECT date_trunc('month', interaction_date)::date AS m, count(*)::int AS n
         FROM ptm_interactions WHERE TRUE ${c} GROUP BY 1
     )
     SELECT extract(year FROM months.m)::int AS y, extract(month FROM months.m)::int AS m,
            COALESCE(adm.n, 0) AS admissions, COALESCE(att.marked, 0) AS marked,
            COALESCE(att.present, 0) AS present, COALESCE(ptm.n, 0) AS ptms
       FROM months
       LEFT JOIN adm ON adm.m = months.m
       LEFT JOIN att ON att.m = months.m
       LEFT JOIN ptm ON ptm.m = months.m
      ORDER BY months.m`,
    params,
  );

  const out = new Map<string, TrendRow>();
  for (const r of months) {
    const ay = academicYear(r.y, r.m);
    const key = period === "month" ? `${r.y}-${String(r.m).padStart(2, "0")}`
      : period === "quarter" ? `${ay}-Q${academicQuarter(r.m)}` : ay;
    const label = period === "month" ? `${MONTHS[r.m - 1]} ${String(r.y).slice(2)}`
      : period === "quarter" ? `Q${academicQuarter(r.m)} ${ay.slice(2)}` : ay;
    const row = out.get(key) ?? { key, label, admissions: 0, marked: 0, present: 0, ptms: 0 };
    row.admissions += r.admissions; row.marked += r.marked;
    row.present += r.present; row.ptms += r.ptms;
    out.set(key, row);
  }
  return [...out.values()];
}
