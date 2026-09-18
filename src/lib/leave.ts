import "server-only";
import { query, one } from "./db";
import type { LeaveRow } from "./leave-meta";

/**
 * A request, with the people around it: who asked, from which centre, who
 * answered, and whether a backup teacher was put in for those dates. The cover
 * is looked up rather than stored, so ending a stand-in is reflected here too.
 */
const SELECT = `
  SELECT r.id, r.user_id, u.name AS staff_name, u.role,
         COALESCE(c.name, uc.name) AS center_name,
         r.leave_type, r.starts_on, r.ends_on, r.half_day, r.reason, r.status,
         d.name AS decided_by_name, r.decided_at, r.decision_note, r.created_at,
         (SELECT b.name FROM teacher_coverage tc
            JOIN users b ON b.id = tc.backup_id
           WHERE tc.covering_id = r.user_id
             AND tc.starts_on <= r.ends_on
             AND (tc.ends_on IS NULL OR tc.ends_on >= r.starts_on)
           ORDER BY tc.starts_on LIMIT 1)               AS backup_name
    FROM staff_leave_requests r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN centers c  ON c.id = r.center_id
    LEFT JOIN centers uc ON uc.id = u.center_id
    LEFT JOIN users d ON d.id = r.decided_by`;

/** Everything one member of staff has asked for, newest first. */
export function myLeave(userId: number) {
  return query<LeaveRow>(`${SELECT} WHERE r.user_id = $1 ORDER BY r.starts_on DESC LIMIT 50`,
    [userId]);
}

/** The administrator's queue: pending first, then recent decisions. */
export function leaveQueue(status: string | null, centerId: number | null) {
  const params: unknown[] = [];
  let where = "";
  if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }
  if (centerId) {
    params.push(centerId);
    where += ` AND COALESCE(r.center_id, u.center_id) = $${params.length}`;
  }
  return query<LeaveRow>(
    `${SELECT} WHERE TRUE ${where}
      ORDER BY (r.status = 'pending') DESC, r.starts_on DESC LIMIT 200`,
    params,
  );
}

export async function pendingLeaveCount(centerId: number | null) {
  const row = await one<{ n: string }>(
    `SELECT count(*) AS n FROM staff_leave_requests r
       JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pending'
        ${centerId ? "AND COALESCE(r.center_id, u.center_id) = $1" : ""}`,
    centerId ? [centerId] : [],
  );
  return Number(row?.n ?? 0);
}

export type AwayToday = {
  user_id: number;
  name: string;
  role: string;
  center_name: string | null;
  /** 'leave' when approved leave covers today, 'absent' when marked so, else null. */
  marked: string | null;
  leave_type: string | null;
  backup_name: string | null;
};

/**
 * Who is not at their centre today, and whether somebody is standing in.
 *
 * "Not here" is deliberately three different things kept apart: approved leave,
 * a manager marking somebody absent, and simply not having checked in yet. The
 * third is normal at nine in the morning and alarming at noon, so the page says
 * which it is rather than calling them all absent.
 */
export function awayToday(centerId: number | null) {
  const params: unknown[] = [];
  let where = "";
  if (centerId) { params.push(centerId); where += ` AND u.center_id = $${params.length}`; }
  return query<AwayToday>(
    `SELECT u.id AS user_id, u.name, u.role, c.name AS center_name,
            CASE
              WHEN l.id IS NOT NULL THEN 'leave'
              WHEN a.status IN ('absent','leave') THEN a.status
              ELSE NULL
            END                                            AS marked,
            l.leave_type,
            (SELECT b.name FROM teacher_coverage tc
               JOIN users b ON b.id = tc.backup_id
              WHERE tc.covering_id = u.id
                AND tc.starts_on <= CURRENT_DATE
                AND (tc.ends_on IS NULL OR tc.ends_on >= CURRENT_DATE)
              ORDER BY tc.starts_on LIMIT 1)               AS backup_name
       FROM users u
       LEFT JOIN centers c ON c.id = u.center_id
       LEFT JOIN staff_attendance a
              ON a.user_id = u.id AND a.att_date = CURRENT_DATE
       LEFT JOIN staff_leave_requests l
              ON l.user_id = u.id AND l.status = 'approved'
             AND CURRENT_DATE BETWEEN l.starts_on AND l.ends_on
      WHERE u.is_active AND u.role IN ('teacher','center_manager') ${where}
        AND (a.check_in_at IS NULL OR a.status IN ('absent','leave'))
      ORDER BY (l.id IS NOT NULL) DESC, c.code, u.name`,
    params,
  );
}

/** Teachers on the books, and how many of them have checked in today. */
export async function staffToday(centerId: number | null) {
  const row = await one<{
    teachers: string; managers: string; backups: string; checked_in: string;
  }>(
    `SELECT count(*) FILTER (WHERE u.role = 'teacher')          AS teachers,
            count(*) FILTER (WHERE u.role = 'center_manager')   AS managers,
            (SELECT count(*) FROM users b
              WHERE b.is_active AND b.role = 'backup_teacher')  AS backups,
            count(*) FILTER (WHERE a.check_in_at IS NOT NULL)   AS checked_in
       FROM users u
       LEFT JOIN staff_attendance a
              ON a.user_id = u.id AND a.att_date = CURRENT_DATE
      WHERE u.is_active AND u.role IN ('teacher','center_manager')
        ${centerId ? "AND u.center_id = $1" : ""}`,
    centerId ? [centerId] : [],
  );
  return {
    teachers: Number(row?.teachers ?? 0),
    managers: Number(row?.managers ?? 0),
    backups: Number(row?.backups ?? 0),
    checkedIn: Number(row?.checked_in ?? 0),
  };
}
