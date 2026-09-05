"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { one, query } from "@/lib/db";
import { today } from "@/lib/format";
import {
  canAnswerSuggestions, canConductAudit, canScheduleVisits, seesAllAudits,
} from "@/lib/roles";
import {
  BAND_NEEDS_REASON, PRIORITY_DAYS, PRIORITIES, VERDICTS, VISIT_KINDS,
  freezeScore, type Priority, type Verdict, type VisitKind,
} from "@/lib/audits";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Adds days to a date the same way the rest of the app counts them. */
function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- scheduling */

export async function scheduleVisit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canScheduleVisits(user.role))
    return { error: "Only an admin or super admin schedules a visit." };

  const centerId = num(form, "center_id");
  const auditorId = num(form, "auditor_id");
  const kind = String(form.get("kind") ?? "scheduled") as VisitKind;
  const on = str(form, "scheduled_for");

  if (!centerId) return { error: "Pick a centre." };
  if (!auditorId) return { error: "Pick an auditor." };
  if (!VISIT_KINDS.includes(kind)) return { error: "Pick the kind of visit." };
  if (!on) return { error: "Pick a date." };

  const auditor = await one<{ role: string }>(
    "SELECT role FROM users WHERE id = $1 AND is_active", [auditorId]);
  if (auditor?.role !== "auditor") return { error: "That person is not an auditor." };

  await query(
    `INSERT INTO audit_visits (center_id, auditor_id, kind, scheduled_for, scheduled_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [centerId, auditorId, kind, on, user.uid]);

  revalidatePath("/audits");
  return { ok: "Visit scheduled." };
}

export async function cancelVisit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canScheduleVisits(user.role))
    return { error: "Only an admin or super admin cancels a visit." };
  const id = num(form, "visit_id");
  if (!id) return { error: "Which visit?" };

  const v = await one<{ status: string }>(
    "SELECT status FROM audit_visits WHERE id = $1", [id]);
  if (!v) return { error: "That visit is gone." };
  if (v.status === "submitted")
    return { error: "That report is already filed; it cannot be cancelled." };

  await query(
    "UPDATE audit_visits SET status = 'cancelled', updated_at = now() WHERE id = $1", [id]);
  revalidatePath("/audits");
  return { ok: "Visit cancelled." };
}

/* ------------------------------------------------------------- the visit */

/** The auditor's own visit, still open for editing. */
async function ownOpenVisit(uid: number, role: Role, visitId: number) {
  if (!canConductAudit(role)) return { error: "Only an auditor fills in a visit." };
  const v = await one<{ id: number; auditor_id: number | null; status: string; center_id: number }>(
    "SELECT id, auditor_id, status, center_id FROM audit_visits WHERE id = $1", [visitId]);
  if (!v) return { error: "That visit is gone." };
  if (v.auditor_id !== uid) return { error: "That visit is assigned to another auditor." };
  if (v.status === "submitted") return { error: "This report is already filed." };
  if (v.status === "cancelled") return { error: "This visit was cancelled." };
  return { visit: v };
}

export async function startVisit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = num(form, "visit_id");
  if (!id) return { error: "Which visit?" };
  const got = await ownOpenVisit(user.uid, user.role, id);
  if ("error" in got) return got;

  await query(
    `UPDATE audit_visits
        SET status = 'in_progress', visited_on = COALESCE(visited_on, $2), updated_at = now()
      WHERE id = $1`, [id, today()]);
  revalidatePath(`/audits/${id}`);
  return { ok: "Visit started." };
}

export async function saveVisitDetails(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = num(form, "visit_id");
  if (!id) return { error: "Which visit?" };
  const got = await ownOpenVisit(user.uid, user.role, id);
  if ("error" in got) return got;

  await query(
    `UPDATE audit_visits
        SET children_present = $2, children_on_roll = $3,
            staff_present = $4, staff_on_roll = $5,
            overall = $6, summary = $7,
            status = CASE WHEN status = 'planned' THEN 'in_progress' ELSE status END,
            visited_on = COALESCE(visited_on, $8),
            updated_at = now()
      WHERE id = $1`,
    [id, num(form, "children_present"), num(form, "children_on_roll"),
      num(form, "staff_present"), num(form, "staff_on_roll"),
      str(form, "overall"), str(form, "summary"), today()]);

  revalidatePath(`/audits/${id}`);
  return { ok: "Saved." };
}

/** One criterion, saved as the auditor works down the list. */
export async function saveRating(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = num(form, "visit_id");
  const criterionId = num(form, "criterion_id");
  const band = num(form, "band");
  if (!id || !criterionId) return { error: "Which criterion?" };
  if (band == null || band < 0 || band > 4) return { error: "Pick a rating." };

  const got = await ownOpenVisit(user.uid, user.role, id);
  if ("error" in got) return got;

  const c = await one<{ section: string; title: string; weight: number }>(
    "SELECT section, title, weight FROM audit_criteria WHERE id = $1", [criterionId]);
  if (!c) return { error: "That criterion is gone." };

  const reason = str(form, "reason");
  if (band > 0 && band <= BAND_NEEDS_REASON && !reason)
    return { error: "A low rating needs a reason." };

  await query(
    `INSERT INTO audit_ratings
       (visit_id, criterion_id, section, criterion_title, weight, band, reason, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (visit_id, criterion_id) DO UPDATE
       SET band = EXCLUDED.band, reason = EXCLUDED.reason, note = EXCLUDED.note,
           section = EXCLUDED.section, criterion_title = EXCLUDED.criterion_title,
           weight = EXCLUDED.weight`,
    [id, criterionId, c.section, c.title, c.weight, band,
      band > 0 && band <= BAND_NEEDS_REASON ? reason : null, str(form, "note")]);

  revalidatePath(`/audits/${id}`);
  return { ok: "Saved." };
}

export async function submitVisit(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = num(form, "visit_id");
  if (!id) return { error: "Which visit?" };
  const got = await ownOpenVisit(user.uid, user.role, id);
  if ("error" in got) return got;

  const v = await one<{ overall: string | null }>(
    "SELECT overall FROM audit_visits WHERE id = $1", [id]);
  if (!v?.overall)
    return { error: "Set how you found the centre overall before filing." };

  const rated = await one<{ n: string }>(
    "SELECT count(*) AS n FROM audit_ratings WHERE visit_id = $1", [id]);
  if (Number(rated?.n ?? 0) === 0)
    return { error: "Rate at least one point before filing." };

  await freezeScore(id);
  await query(
    `UPDATE audit_visits
        SET status = 'submitted', submitted_at = now(),
            visited_on = COALESCE(visited_on, $2), updated_at = now()
      WHERE id = $1`, [id, today()]);

  revalidatePath("/audits");
  revalidatePath(`/audits/${id}`);
  redirect(`/audits/${id}`);
}

/* --------------------------------------------------------- the suggestions */

export async function addSuggestion(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const visitId = num(form, "visit_id");
  if (!visitId) return { error: "Which visit?" };
  const got = await ownOpenVisit(user.uid, user.role, visitId);
  if ("error" in got) return got;

  const title = str(form, "title");
  if (!title) return { error: "Say what needs doing." };
  const priority = String(form.get("priority") ?? "medium") as Priority;
  if (!PRIORITIES.includes(priority)) return { error: "Pick a priority." };

  // The centre gets until the date the auditor sets, or a window that matches
  // how urgent they said it was.
  const due = str(form, "due_on") ?? plusDays(today(), PRIORITY_DAYS[priority]);

  await query(
    `INSERT INTO audit_suggestions
       (visit_id, center_id, criterion_id, title, detail, priority, due_on, raised_by, raised_on)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [visitId, got.visit.center_id, num(form, "criterion_id"), title,
      str(form, "detail"), priority, due, user.uid, today()]);

  revalidatePath(`/audits/${visitId}`);
  return { ok: "Suggestion added." };
}

/** The auditor's verdict on something raised at an earlier visit. */
export async function verifySuggestion(_prev: unknown, form: FormData) {
  const user = await requireUser();
  if (!canConductAudit(user.role))
    return { error: "Only an auditor closes a suggestion." };

  const id = num(form, "suggestion_id");
  const verdict = String(form.get("verdict") ?? "") as Verdict;
  if (!id) return { error: "Which suggestion?" };
  if (!VERDICTS.includes(verdict)) return { error: "Pick a verdict." };

  const s = await one<{ status: string; center_id: number }>(
    "SELECT status, center_id FROM audit_suggestions WHERE id = $1", [id]);
  if (!s) return { error: "That suggestion is gone." };
  if (s.status === "verified" || s.status === "not_done")
    return { error: "This one has already been closed off." };

  await query(
    `UPDATE audit_suggestions
        SET verdict = $2,
            status = CASE WHEN $2 = 'not_done' THEN 'not_done' ELSE 'verified' END,
            verified_by = $3, verified_visit_id = $4, verified_on = $5, updated_at = now()
      WHERE id = $1`,
    [id, verdict, user.uid, num(form, "visit_id"), today()]);

  const note = str(form, "note");
  if (note) {
    await query(
      `INSERT INTO audit_replies (suggestion_id, author_id, body, set_status)
       VALUES ($1,$2,$3,$4)`,
      [id, user.uid, note, verdict === "not_done" ? "not_done" : "verified"]);
  }

  revalidatePath("/audits/suggestions");
  return { ok: "Verdict recorded." };
}

/* --------------------------------------------- what the centre did about it */

/**
 * The centre's answer. A reply may also move the item along — "we have done
 * this" is the same act as saying so — which is why the status rides on the
 * reply rather than sitting behind a separate button.
 */
export async function replyToSuggestion(_prev: unknown, form: FormData) {
  const user = await requireUser();
  const id = num(form, "suggestion_id");
  if (!id) return { error: "Which suggestion?" };

  const body = str(form, "body");
  if (!body) return { error: "Write what you have done." };

  const s = await one<{ center_id: number; status: string }>(
    "SELECT center_id, status FROM audit_suggestions WHERE id = $1", [id]);
  if (!s) return { error: "That suggestion is gone." };

  const mayAnswer = canAnswerSuggestions(user.role)
    && (user.centerId === s.center_id || user.centerIds.includes(s.center_id));
  if (!mayAnswer && !seesAllAudits(user.role))
    return { error: "That suggestion belongs to another centre." };

  // only the centre moves an item forward; an auditor replying is commenting
  const wanted = str(form, "set_status");
  const move = mayAnswer && (wanted === "in_progress" || wanted === "done")
    ? wanted : null;

  await query(
    "INSERT INTO audit_replies (suggestion_id, author_id, body, set_status) VALUES ($1,$2,$3,$4)",
    [id, user.uid, body, move]);

  if (move) {
    await query(
      `UPDATE audit_suggestions
          SET status = $2,
              done_claimed_on = CASE WHEN $2 = 'done' THEN $3 ELSE done_claimed_on END,
              updated_at = now()
        WHERE id = $1 AND status IN ('open','in_progress','done')`,
      [id, move, today()]);
  }

  revalidatePath("/audits/suggestions");
  revalidatePath(`/audits/suggestions/${id}`);
  return { ok: "Sent." };
}
