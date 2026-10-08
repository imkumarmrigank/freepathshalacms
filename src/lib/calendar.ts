import "server-only";
import { query } from "./db";

export type { CalendarEvent } from "./calendar-meta";
export { EVENT_LABEL, EVENT_TONE, HOLIDAY_TYPES } from "./calendar-meta";

import type { CalendarEvent } from "./calendar-meta";

/**
 * Everything on the calendar between two dates: manually added events plus the
 * PTM days scheduled from the PTM section, so both show in one place.
 */
export async function eventsBetween(from: string, to: string, centerId: number | null) {
  const params: unknown[] = [from, to];
  let scope = "";
  if (centerId) {
    params.push(centerId);
    scope = ` AND (e.center_id IS NULL OR e.center_id = $${params.length})`;
  }

  if (centerId) {
    // looking at one centre: an event it was excepted from does not apply
    scope += ` AND NOT EXISTS (
                 SELECT 1 FROM calendar_event_exceptions x
                  WHERE x.event_id = e.id AND x.center_id = $${params.length})`;
  }

  const events = await query<CalendarEvent>(
    `SELECT e.id, e.title, e.event_type, e.center_id, c.name AS center_name,
            e.start_date, e.end_date, e.is_all_day, e.start_time, e.end_time,
            e.description, e.affects_attendance, 'calendar' AS source,
            COALESCE((
              SELECT array_agg(ce.name ORDER BY ce.code)
                FROM calendar_event_exceptions x
                JOIN centers ce ON ce.id = x.center_id
               WHERE x.event_id = e.id), '{}') AS open_centres
       FROM calendar_events e
       LEFT JOIN centers c ON c.id = e.center_id
      WHERE e.start_date <= $2 AND e.end_date >= $1 ${scope}
      ORDER BY e.start_date, e.start_time NULLS FIRST`,
    params,
  );

  const ptmParams: unknown[] = [from, to];
  let ptmScope = "";
  if (centerId) { ptmParams.push(centerId); ptmScope = ` AND m.center_id = $${ptmParams.length}`; }

  const ptms = await query<CalendarEvent>(
    `SELECT m.id, m.title, 'ptm' AS event_type, m.center_id, c.name AS center_name,
            m.meeting_date AS start_date, m.meeting_date AS end_date,
            (m.start_time IS NULL) AS is_all_day, m.start_time, m.end_time,
            m.agenda AS description, FALSE AS affects_attendance, 'ptm' AS source,
            '{}'::text[] AS open_centres
       FROM ptm_meetings m
       JOIN centers c ON c.id = m.center_id
      WHERE m.meeting_date BETWEEN $1 AND $2 AND m.status <> 'cancelled' ${ptmScope}
      ORDER BY m.meeting_date`,
    ptmParams,
  );

  return [...events, ...ptms].sort((a, b) =>
    a.start_date === b.start_date
      ? (a.start_time ?? "").localeCompare(b.start_time ?? "")
      : a.start_date.localeCompare(b.start_date));
}

/** Holiday or closure covering this date for this centre, if any. */
export async function holidayOn(date: string, centerId: number | null) {
  const params: unknown[] = [date];
  let scope = "";
  if (centerId) {
    params.push(centerId);
    // a centre excepted from an all-centres holiday is working that day
    scope = ` AND (e.center_id IS NULL OR e.center_id = $${params.length})
              AND NOT EXISTS (
                SELECT 1 FROM calendar_event_exceptions x
                 WHERE x.event_id = e.id AND x.center_id = $${params.length})`;
  }
  const rows = await query<{ title: string; event_type: string }>(
    `SELECT e.title, e.event_type FROM calendar_events e
      WHERE e.affects_attendance AND $1::date BETWEEN e.start_date AND e.end_date ${scope}
      LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

/**
 * Every holiday and closure in a period, with the centres that are working
 * through each one.
 *
 * The calendar shows a month at a time, which is the wrong shape for the
 * question "what are this year's holidays, and who is open on them?". This is
 * that list: one row a holiday, in date order, whatever month it falls in.
 */
export type HolidayRow = {
  id: number;
  title: string;
  event_type: string;
  center_id: number | null;
  center_name: string | null;
  start_date: string;
  end_date: string;
  days: number;
  description: string | null;
  affects_attendance: boolean;
  /** Centres recorded as working through it, as an exception. */
  open_centres: { id: number; code: string; name: string; reason: string | null }[];
};

export async function holidaysBetween(from: string, to: string, centerId: number | null) {
  const params: unknown[] = [from, to];
  let scope = "";
  if (centerId) {
    params.push(centerId);
    scope = ` AND (e.center_id IS NULL OR e.center_id = $${params.length})`;
  }
  return query<HolidayRow>(
    `SELECT e.id, e.title, e.event_type, e.center_id, c.name AS center_name,
            to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
            to_char(e.end_date, 'YYYY-MM-DD')   AS end_date,
            (e.end_date - e.start_date + 1)     AS days,
            e.description, e.affects_attendance,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', ce.id, 'code', ce.code, 'name', ce.name, 'reason', x.reason)
                     ORDER BY ce.code)
                FROM calendar_event_exceptions x
                JOIN centers ce ON ce.id = x.center_id
               WHERE x.event_id = e.id), '[]') AS open_centres
       FROM calendar_events e
       LEFT JOIN centers c ON c.id = e.center_id
      WHERE e.event_type IN ('holiday', 'closure')
        AND e.start_date <= $2 AND e.end_date >= $1 ${scope}
      ORDER BY e.start_date, e.title`,
    params);
}
