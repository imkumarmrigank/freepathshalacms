import "server-only";
import { query, one } from "@/lib/db";

/* ───────────────────────── types ────────────────────────── */

export type UnitRow = {
  id: number;
  session_id: number;
  class_level_id: number;
  subject: string;
  term_no: number;
  month_no: number;
  heading: string | null;
  outcome: string | null;
  class_name: string;
  /** only when centerId supplied */
  status: "not_started" | "in_progress" | "completed";
  completed_on: string | null;
  remarks: string | null;
  marked_by_name: string | null;
  items: number;
  ticked: number;
};

export type Item = {
  id: number;
  unit_id: number;
  position: number;
  week_no: number;
  text: string;
  /** only when centerId supplied */
  done: boolean;
  done_on: string | null;
};

export type CentreProgress = {
  center_id: number;
  center_name: string;
  months: number;
  completed: number;
  in_progress: number;
};

/* ───────────────────────── queries ──────────────────────── */

/** Distinct subjects for a session + class. */
export async function subjectsFor(sessionId: number, classId: number): Promise<string[]> {
  const rows = await query<{ subject: string }>(
    `SELECT DISTINCT subject FROM syllabus_units
      WHERE session_id = $1 AND class_level_id = $2
      ORDER BY subject`,
    [sessionId, classId],
  );
  return rows.map((r) => r.subject);
}

/** All units for a session + class, optionally filtered by subject and centre. */
export async function unitsFor(
  sessionId: number,
  classId: number,
  centerId: number | null,
  subject: string | null,
): Promise<UnitRow[]> {
  return query<UnitRow>(`
    SELECT
      u.id, u.session_id, u.class_level_id, u.subject,
      u.term_no, u.month_no, u.heading, u.outcome,
      COALESCE(cl.name, u.class_level_id::text)                     AS class_name,
      COALESCE(p.status, 'not_started')                             AS status,
      p.completed_on::text                                          AS completed_on,
      p.remarks,
      mu.name                                                        AS marked_by_name,
      COUNT(DISTINCT i.id)                                          AS items,
      COUNT(DISTINCT t.item_id)                                     AS ticked
    FROM syllabus_units u
    LEFT JOIN class_levels cl ON cl.id = u.class_level_id
    LEFT JOIN syllabus_items i    ON i.unit_id = u.id
    LEFT JOIN syllabus_item_ticks t
      ON t.item_id = i.id AND ($3::int IS NULL OR t.center_id = $3)
    LEFT JOIN syllabus_progress p
      ON p.unit_id = u.id AND ($3::int IS NULL OR p.center_id = $3)
    LEFT JOIN users mu ON mu.id = p.marked_by
    WHERE u.session_id = $1
      AND u.class_level_id = $2
      AND ($4::text IS NULL OR u.subject = $4)
    GROUP BY u.id, cl.name, p.status, p.completed_on, p.remarks, mu.name
    ORDER BY u.subject, u.term_no, u.month_no
  `, [sessionId, classId, centerId, subject]);
}

/** One unit row. */
export async function unitById(unitId: number, centerId: number | null): Promise<UnitRow | null> {
  return one<UnitRow>(`
    SELECT
      u.id, u.session_id, u.class_level_id, u.subject,
      u.term_no, u.month_no, u.heading, u.outcome,
      COALESCE(cl.name, u.class_level_id::text)                     AS class_name,
      COALESCE(p.status, 'not_started')                             AS status,
      p.completed_on::text                                          AS completed_on,
      p.remarks,
      mu.name                                                        AS marked_by_name,
      COUNT(DISTINCT i.id)                                          AS items,
      COUNT(DISTINCT t.item_id)                                     AS ticked
    FROM syllabus_units u
    LEFT JOIN class_levels cl ON cl.id = u.class_level_id
    LEFT JOIN syllabus_items i    ON i.unit_id = u.id
    LEFT JOIN syllabus_item_ticks t
      ON t.item_id = i.id AND ($2::int IS NULL OR t.center_id = $2)
    LEFT JOIN syllabus_progress p
      ON p.unit_id = u.id AND ($2::int IS NULL OR p.center_id = $2)
    LEFT JOIN users mu ON mu.id = p.marked_by
    WHERE u.id = $1
    GROUP BY u.id, cl.name, p.status, p.completed_on, p.remarks, mu.name
  `, [unitId, centerId]);
}

/** Items in a unit, with per-centre tick state when centerId is given. */
export async function itemsFor(unitId: number, centerId: number | null): Promise<Item[]> {
  return query<Item>(`
    SELECT
      i.id, i.unit_id, i.position, i.week_no, i.text,
      (t.item_id IS NOT NULL) AS done,
      t.done_on::text         AS done_on
    FROM syllabus_items i
    LEFT JOIN syllabus_item_ticks t
      ON t.item_id = i.id AND ($2::int IS NULL OR t.center_id = $2)
    WHERE i.unit_id = $1
    ORDER BY i.week_no, i.position, i.id
  `, [unitId, centerId]);
}

/** Per-week remarks for a unit at a centre. */
export async function weekProgressFor(unitId: number, centerId: number) {
  return query<{ week_no: number; remarks: string | null; marked_by_name: string | null }>(
    `SELECT w.week_no, w.remarks,
       u.name AS marked_by_name
     FROM syllabus_week_progress w
     LEFT JOIN users u ON u.id = w.marked_by
     WHERE w.unit_id = $1 AND w.center_id = $2
     ORDER BY w.week_no`,
    [unitId, centerId],
  );
}

/** Progress for one unit at one centre — returns a single row or null. */
export async function progressFor(unitId: number, centerId: number) {
  return one<{
    status: string;
    completed_on: string | null;
    remarks: string | null;
    marked_by_name: string | null;
  }>(`
    SELECT p.status, p.completed_on::text, p.remarks,
      u.name AS marked_by_name
    FROM syllabus_progress p
    LEFT JOIN users u ON u.id = p.marked_by
    WHERE p.unit_id = $1 AND p.center_id = $2
  `, [unitId, centerId]);
}

/** Summary per centre for admins (how far each centre has got). */
export async function centreProgress(
  sessionId: number,
  classId: number,
  subject: string | null,
): Promise<CentreProgress[]> {
  return query<CentreProgress>(`
    SELECT
      c.id                                                            AS center_id,
      c.name                                                          AS center_name,
      COUNT(DISTINCT u.id)                                            AS months,
      COUNT(DISTINCT p.unit_id) FILTER (WHERE p.status = 'completed') AS completed,
      COUNT(DISTINCT p.unit_id) FILTER (WHERE p.status = 'in_progress') AS in_progress
    FROM centers c
    CROSS JOIN syllabus_units u
    LEFT JOIN syllabus_progress p
      ON p.unit_id = u.id AND p.center_id = c.id
    WHERE u.session_id = $1
      AND u.class_level_id = $2
      AND ($3::text IS NULL OR u.subject = $3)
    GROUP BY c.id, c.name
    ORDER BY c.name
  `, [sessionId, classId, subject]);
}
