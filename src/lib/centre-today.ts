import { query } from "./db";

const IST = "AT TIME ZONE 'Asia/Kolkata'";

/* -------------------------------------------------------------- the cards */

export type CentreCard = {
  id: number;
  code: string;
  name: string;
  /** Children marked present, absent, and how many were on the register. */
  present: number;
  absent: number;
  roll: number;
  /** Classes whose register was filled, against the classes the centre runs. */
  classes_marked: number;
  classes_expected: number;
  /** Staff who checked in, against the staff on the centre's books. */
  staff_in: number;
  staff_on_roll: number;
  first_in: string | null;
  /** Who else came, and what was written up. */
  ptms: number;
  flags: number;
  audit_visits: number;
  sports_visits: number;
  notes_written: number;
  people: number;
};

/**
 * Every centre on one day, at a glance: the register, who was in, and what
 * else happened there. One row a card.
 */
export function centreCards(on: string) {
  return query<CentreCard>(
    `SELECT c.id, c.code, c.name,
            COALESCE(r.present, 0)  AS present,
            COALESCE(r.absent, 0)   AS absent,
            COALESCE(r.roll, 0)     AS roll,
            COALESCE(r.classes, 0)  AS classes_marked,
            (SELECT count(DISTINCT e.class_level_id)::int
               FROM enrollments e
               JOIN students st ON st.id = e.student_id
              WHERE st.center_id = c.id AND st.status = 'active'
                AND e.status = 'active')                           AS classes_expected,
            COALESCE(sa.staff_in, 0) AS staff_in,
            (SELECT count(*)::int FROM users u
              WHERE u.center_id = c.id AND u.is_active AND NOT u.is_test
                AND u.role IN ('teacher','center_manager'))        AS staff_on_roll,
            sa.first_in,
            COALESCE(p.n, 0)  AS ptms,
            COALESCE(f.n, 0)  AS flags,
            COALESCE(av.n, 0) AS audit_visits,
            COALESCE(sv.n, 0) AS sports_visits,
            COALESCE(nt.n, 0) AS notes_written,
            COALESCE(sa.staff_in, 0) + COALESCE(sv.n, 0)
              + COALESCE(av.n, 0) + COALESCE(p.people, 0)          AS people
       FROM centers c
       LEFT JOIN (
         SELECT s.center_id,
                count(*) FILTER (WHERE s.status = 'present')::int AS present,
                count(*) FILTER (WHERE s.status IN ('absent','leave'))::int AS absent,
                count(*)::int AS roll,
                count(DISTINCT s.class_level_id)::int AS classes
           FROM student_attendance s
          WHERE s.att_date = $1
          GROUP BY s.center_id) r ON r.center_id = c.id
       LEFT JOIN (
         SELECT a.center_id, count(*)::int AS staff_in,
                to_char(min(a.check_in_at) ${IST}, 'HH24:MI') AS first_in
           FROM staff_attendance a
           JOIN users u ON u.id = a.user_id AND NOT u.is_test
          WHERE a.att_date = $1 AND a.check_in_at IS NOT NULL
            -- the centre's own people; a visitor shows as a visit, not as staff
            AND u.role IN ('teacher','center_manager','backup_teacher','rider')
          GROUP BY a.center_id) sa ON sa.center_id = c.id
       LEFT JOIN (
         SELECT i.center_id, count(*)::int AS n,
                count(DISTINCT i.mentor_id)::int AS people
           FROM ptm_interactions i
           LEFT JOIN users u ON u.id = i.mentor_id
          WHERE i.interaction_date = $1 AND NOT COALESCE(u.is_test, false)
          GROUP BY i.center_id) p ON p.center_id = c.id
       LEFT JOIN (
         SELECT cf.center_id, count(*)::int AS n
           FROM counselling_flags cf
           LEFT JOIN users u ON u.id = cf.raised_by
          WHERE cf.raised_on = $1 AND NOT COALESCE(u.is_test, false)
          GROUP BY cf.center_id) f ON f.center_id = c.id
       LEFT JOIN (
         SELECT v.center_id, count(*)::int AS n
           FROM audit_visits v
           LEFT JOIN users u ON u.id = v.auditor_id
          WHERE COALESCE(v.visited_on, v.scheduled_for) = $1
            AND v.status <> 'cancelled' AND NOT COALESCE(u.is_test, false)
          GROUP BY v.center_id) av ON av.center_id = c.id
       LEFT JOIN (
         SELECT v.center_id, count(*)::int AS n
           FROM sports_visits v
           JOIN users u ON u.id = v.user_id AND NOT u.is_test
          WHERE v.visit_date = $1
          GROUP BY v.center_id) sv ON sv.center_id = c.id
       LEFT JOIN (
         SELECT n.center_id, count(*)::int AS n
           FROM (SELECT center_id, user_id FROM teacher_day_notes WHERE on_date = $1
                 UNION ALL
                 SELECT center_id, user_id FROM staff_day_notes WHERE on_date = $1) n
           JOIN users u ON u.id = n.user_id AND NOT u.is_test
          GROUP BY n.center_id) nt ON nt.center_id = c.id
      WHERE c.is_active
      ORDER BY c.code`,
    [on]);
}

/* ------------------------------------------------------------- the detail */

export type PersonDay = {
  user_id: number;
  name: string;
  role: string;
  check_in: string | null;
  check_out: string | null;
  minutes: number | null;
  by_hand: boolean | null;
  distance_m: number | null;
  /** What they did, in short lines, ready to print under the name. */
  did: string[];
  /** What they wrote up themselves, in their own words. */
  wrote: { label: string; text: string }[];
};

type Row = { user_id: number; name: string; role: string };

/** Everyone who worked at one centre on one day, and what each of them did. */
export async function centreDay(centerId: number, on: string) {
  const [centre, punches, byClass, reasons, tNotes, ptms, flags, visits, sports, sNotes] =
    await Promise.all([
      query<{ id: number; code: string; name: string }>(
        "SELECT id, code, name FROM centers WHERE id = $1", [centerId]),
      query<Row & {
        check_in: string | null; check_out: string | null; minutes: number | null;
        by_hand: boolean | null; distance_m: number | null; status: string | null;
      }>(
        `SELECT u.id AS user_id, u.name, u.role,
                to_char(a.check_in_at ${IST}, 'HH24:MI')  AS check_in,
                to_char(a.check_out_at ${IST}, 'HH24:MI') AS check_out,
                a.worked_minutes AS minutes, a.by_hand,
                a.check_in_distance_m AS distance_m, a.status
           FROM staff_attendance a
           JOIN users u ON u.id = a.user_id AND NOT u.is_test
          WHERE a.center_id = $1 AND a.att_date = $2
          ORDER BY a.check_in_at`, [centerId, on]),
      query<Row & { class_name: string; present: number; absent: number; roll: number }>(
        `SELECT u.id AS user_id, u.name, u.role, cl.name AS class_name,
                count(*) FILTER (WHERE s.status = 'present')::int AS present,
                count(*) FILTER (WHERE s.status IN ('absent','leave'))::int AS absent,
                count(*)::int AS roll
           FROM student_attendance s
           JOIN users u ON u.id = s.marked_by AND NOT u.is_test
           JOIN class_levels cl ON cl.id = s.class_level_id
          WHERE s.center_id = $1 AND s.att_date = $2
          GROUP BY u.id, u.name, u.role, cl.id, cl.sequence, cl.name
          ORDER BY cl.sequence`, [centerId, on]),
      query<Row & { reason: string; n: number }>(
        `SELECT u.id AS user_id, u.name, u.role,
                COALESCE(s.reason, 'No reason given') AS reason, count(*)::int AS n
           FROM student_attendance s
           JOIN users u ON u.id = s.marked_by AND NOT u.is_test
          WHERE s.center_id = $1 AND s.att_date = $2 AND s.status IN ('absent','leave')
          GROUP BY u.id, u.name, u.role, 4 ORDER BY 5 DESC`, [centerId, on]),
      query<Row & {
        class_name: string | null; subject: string | null; chapter: string | null;
        chapter_detail: string | null; homework: string | null; homework_detail: string | null;
        equipment: string | null; equipment_result: string | null; other_work: string | null;
        support_needed: string | null; extra_activity: string | null; extra_detail: string | null;
      }>(
        `SELECT u.id AS user_id, u.name, u.role, cl.name AS class_name,
                n.subject, n.chapter, n.chapter_detail, n.homework, n.homework_detail,
                n.equipment, n.equipment_result, n.other_work, n.support_needed,
                n.extra_activity, n.extra_detail
           FROM teacher_day_notes n
           JOIN users u ON u.id = n.user_id AND NOT u.is_test
           LEFT JOIN class_levels cl ON cl.id = n.class_level_id
          WHERE n.center_id = $1 AND n.on_date = $2
          ORDER BY cl.sequence NULLS FIRST`, [centerId, on]),
      query<Row & { held: number; children: number; parents: number; follow_ups: number }>(
        `SELECT u.id AS user_id, u.name, u.role, count(*)::int AS held,
                count(DISTINCT i.student_id)::int AS children,
                count(*) FILTER (WHERE i.parent_present <> 'none')::int AS parents,
                count(*) FILTER (WHERE i.follow_up_required)::int AS follow_ups
           FROM ptm_interactions i
           JOIN users u ON u.id = i.mentor_id AND NOT u.is_test
          WHERE i.center_id = $1 AND i.interaction_date = $2
          GROUP BY u.id, u.name, u.role`, [centerId, on]),
      query<Row & { n: number }>(
        `SELECT u.id AS user_id, u.name, u.role, count(*)::int AS n
           FROM counselling_flags cf
           JOIN users u ON u.id = cf.raised_by AND NOT u.is_test
          WHERE cf.center_id = $1 AND cf.raised_on = $2
          GROUP BY u.id, u.name, u.role`, [centerId, on]),
      query<Row & {
        kind: string; status: string; overall: string | null; score_pct: string | null;
        asks: number; summary: string | null;
      }>(
        `SELECT u.id AS user_id, u.name, u.role, v.kind, v.status, v.overall, v.score_pct,
                (SELECT count(*) FROM audit_suggestions s WHERE s.visit_id = v.id)::int AS asks,
                v.summary
           FROM audit_visits v
           JOIN users u ON u.id = v.auditor_id AND NOT u.is_test
          WHERE v.center_id = $1 AND COALESCE(v.visited_on, v.scheduled_for) = $2
            AND v.status <> 'cancelled'`, [centerId, on]),
      query<Row & {
        sports: string[] | null; children: number | null; activities: string | null;
        highlights: string | null; issues: string | null; filed: boolean;
      }>(
        `SELECT u.id AS user_id, u.name, u.role, v.sports_covered AS sports,
                v.children_count AS children, v.activities, v.highlights, v.issues,
                (v.report_submitted_at IS NOT NULL) AS filed
           FROM sports_visits v
           JOIN users u ON u.id = v.user_id AND NOT u.is_test
          WHERE v.center_id = $1 AND v.visit_date = $2`, [centerId, on]),
      query<Row & Record<string, string | number | null>>(
        `SELECT u.id AS user_id, u.name, u.role, n.summary, n.where_worked, n.plan_next,
                n.support_needed, n.families_met, n.home_visits, n.concerns, n.follow_ups,
                n.what_checked, n.findings, n.urgent_issues, n.told_to_centre,
                n.sports_covered, n.activities, n.children_count, n.equipment_used,
                n.equipment_need, n.talent_spotted, n.injuries
           FROM staff_day_notes n
           JOIN users u ON u.id = n.user_id AND NOT u.is_test
          WHERE n.on_date = $2
            AND (n.center_id = $1 OR n.center_id IS NULL)`, [centerId, on]),
    ]);

  /* Everybody who appears anywhere in the day, folded into one entry each. */
  const people = new Map<number, PersonDay>();
  const at = (r: Row) => {
    let p = people.get(r.user_id);
    if (!p) {
      p = {
        user_id: r.user_id, name: r.name, role: r.role,
        check_in: null, check_out: null, minutes: null, by_hand: null, distance_m: null,
        did: [], wrote: [],
      };
      people.set(r.user_id, p);
    }
    return p;
  };

  for (const r of punches) {
    const p = at(r);
    p.check_in = r.check_in; p.check_out = r.check_out; p.minutes = r.minutes;
    p.by_hand = r.by_hand; p.distance_m = r.distance_m;
  }
  for (const r of byClass) {
    at(r).did.push(`${r.class_name}: ${r.present} present, ${r.absent} absent of ${r.roll}`);
  }
  for (const r of reasons) {
    at(r).did.push(`Absent — ${r.reason.toLowerCase()}: ${r.n}`);
  }
  for (const r of tNotes) {
    const p = at(r);
    const head = [r.class_name, r.subject, r.chapter].filter(Boolean).join(" · ");
    if (head) p.wrote.push({ label: "Taught", text: head });
    for (const [label, text] of [
      ["In the chapter", r.chapter_detail], ["Homework", r.homework],
      ["About the homework", r.homework_detail], ["Equipment", r.equipment],
      ["What came of it", r.equipment_result], ["Other work", r.other_work],
      ["Something else", r.extra_activity], ["About that", r.extra_detail],
      ["Needs", r.support_needed],
    ] as [string, string | null][]) if (text) p.wrote.push({ label, text });
  }
  for (const r of ptms) {
    at(r).did.push(
      `${r.held} parent meeting${r.held === 1 ? "" : "s"} · ${r.children} children · `
      + `${r.parents} parents came · ${r.follow_ups} to follow up`);
  }
  for (const r of flags) {
    at(r).did.push(`${r.n} child${r.n === 1 ? "" : "ren"} flagged for counselling`);
  }
  for (const r of visits) {
    const score = r.score_pct == null ? "" : ` · ${Math.round(Number(r.score_pct))}%`;
    at(r).did.push(
      `Audit visit (${r.kind.replace(/_/g, " ")}) — ${r.status.replace(/_/g, " ")}`
      + `${score}${r.overall ? ` · ${r.overall}` : ""} · ${r.asks} ask${r.asks === 1 ? "" : "s"}`);
    if (r.summary) at(r).wrote.push({ label: "The auditor's summary", text: r.summary });
  }
  for (const r of sports) {
    const p = at(r);
    p.did.push(
      `Sports session${r.sports?.length ? ` — ${r.sports.join(", ")}` : ""}`
      + `${r.children == null ? "" : ` · ${r.children} children`}`
      + `${r.filed ? "" : " · report not filed"}`);
    for (const [label, text] of [
      ["Activities", r.activities], ["Highlights", r.highlights], ["Issues", r.issues],
    ] as [string, string | null][]) if (text) p.wrote.push({ label, text });
  }
  const NOTE_LABEL: Record<string, string> = {
    summary: "The day, in short", where_worked: "Where they worked",
    plan_next: "Next", support_needed: "Needs",
    families_met: "Families met", home_visits: "Home visits",
    concerns: "Concerns", follow_ups: "Follow-ups",
    what_checked: "What was checked", findings: "What they found",
    urgent_issues: "Urgent", told_to_centre: "Told to the centre",
    sports_covered: "Sports", activities: "Activities", children_count: "Children",
    equipment_used: "Equipment used", equipment_need: "Equipment needed",
    talent_spotted: "Worth following", injuries: "Anything that happened",
  };
  for (const r of sNotes) {
    const p = at(r);
    for (const [key, label] of Object.entries(NOTE_LABEL)) {
      const v = r[key];
      if (v != null && String(v).trim() !== "") p.wrote.push({ label, text: String(v) });
    }
  }

  const order = ["center_manager", "teacher", "backup_teacher", "mentor",
                 "auditor", "sports_teacher", "rider"];
  const list = [...people.values()].sort((a, b) => {
    const d = order.indexOf(a.role) - order.indexOf(b.role);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
  return { centre: centre[0] ?? null, people: list };
}
