import "server-only";
import { one, query } from "./db";

/**
 * The syllabus and how far each centre has got with it.
 *
 * The shape is deliberately the other way round from the old teaching plans: a
 * unit belongs to a class and subject for the whole organisation, and progress
 * belongs to a centre. That is what makes "which centres are behind on Class 1
 * Hindi" a question with an answer.
 */

export type Unit = {
  id: number; subject: string; month_no: number;
  heading: string | null; outcome: string | null;
  items: number;
};

export type UnitWithProgress = Unit & {
  status: string; completed_on: string | null; remarks: string | null;
  marked_by_name: string | null; ticked: number;
};

export type Item = { id: number; position: number; text: string; done_on: string | null };

/** Every subject that has a syllabus for this class and session. */
export async function subjectsFor(sessionId: number, classId: number) {
  const rows = await query<{ subject: string }>(
    `SELECT DISTINCT subject FROM syllabus_units
      WHERE session_id = $1 AND class_level_id = $2 ORDER BY subject`,
    [sessionId, classId]);
  return rows.map((r) => r.subject);
}

/**
 * The months of a class's syllabus with one centre's progress against each.
 * Pass no centre and the progress columns come back empty — which is what an
 * administrator looking at the syllabus itself wants.
 */
export async function unitsFor(
  sessionId: number, classId: number, centerId: number | null, subject?: string | null,
) {
  const params: unknown[] = [sessionId, classId, centerId];
  let filter = "";
  if (subject) { params.push(subject); filter = ` AND u.subject = $${params.length}`; }
  return query<UnitWithProgress>(
    `SELECT u.id, u.subject, u.month_no, u.heading, u.outcome,
            (SELECT count(*) FROM syllabus_items i WHERE i.unit_id = u.id) AS items,
            COALESCE(p.status, 'not_started') AS status,
            p.completed_on, p.remarks, m.name AS marked_by_name,
            (SELECT count(*) FROM syllabus_item_ticks t
               JOIN syllabus_items i ON i.id = t.item_id
              WHERE i.unit_id = u.id AND t.center_id = $3) AS ticked
       FROM syllabus_units u
       LEFT JOIN syllabus_progress p ON p.unit_id = u.id AND p.center_id = $3
       LEFT JOIN users m ON m.id = p.marked_by
      WHERE u.session_id = $1 AND u.class_level_id = $2 ${filter}
      ORDER BY u.subject, u.month_no`,
    params);
}

export async function unitById(id: number) {
  return one<{
    id: number; session_id: number; class_level_id: number; subject: string;
    month_no: number; heading: string | null; outcome: string | null;
    class_name: string;
  }>(
    `SELECT u.id, u.session_id, u.class_level_id, u.subject, u.month_no,
            u.heading, u.outcome, cl.name AS class_name
       FROM syllabus_units u JOIN class_levels cl ON cl.id = u.class_level_id
      WHERE u.id = $1`, [id]);
}

/** A unit's lines, with this centre's ticks against them. */
export async function itemsFor(unitId: number, centerId: number | null) {
  return query<Item>(
    `SELECT i.id, i.position, i.text, t.done_on
       FROM syllabus_items i
       LEFT JOIN syllabus_item_ticks t ON t.item_id = i.id AND t.center_id = $2
      WHERE i.unit_id = $1
      ORDER BY i.position, i.id`,
    [unitId, centerId]);
}

export async function progressFor(unitId: number, centerId: number) {
  return one<{
    status: string; completed_on: string | null; remarks: string | null;
    marked_by_name: string | null;
  }>(
    `SELECT p.status, p.completed_on, p.remarks, u.name AS marked_by_name
       FROM syllabus_progress p LEFT JOIN users u ON u.id = p.marked_by
      WHERE p.unit_id = $1 AND p.center_id = $2`,
    [unitId, centerId]);
}

export type CentreRow = {
  center_id: number; center_name: string;
  months: number; completed: number; in_progress: number;
};

/**
 * One row per centre: how many of this class's months it has finished. The
 * question an administrator opens this page to ask.
 */
export async function centreProgress(sessionId: number, classId: number, subject?: string | null) {
  const params: unknown[] = [sessionId, classId];
  let filter = "";
  if (subject) { params.push(subject); filter = ` AND u.subject = $${params.length}`; }
  return query<CentreRow>(
    `SELECT ce.id AS center_id, ce.name AS center_name,
            (SELECT count(*) FROM syllabus_units u
              WHERE u.session_id = $1 AND u.class_level_id = $2 ${filter}) AS months,
            count(*) FILTER (WHERE p.status = 'completed') AS completed,
            count(*) FILTER (WHERE p.status = 'in_progress') AS in_progress
       FROM centers ce
       LEFT JOIN syllabus_progress p ON p.center_id = ce.id
       LEFT JOIN syllabus_units u ON u.id = p.unit_id
        AND u.session_id = $1 AND u.class_level_id = $2 ${filter}
      WHERE ce.is_active
      GROUP BY ce.id, ce.name, ce.code
      ORDER BY ce.code`,
    params);
}
