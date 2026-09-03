"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { isManualKey, type Note } from "@/lib/manual";

/** Textareas hold one item per line — the simplest editor for a list of steps. */
const lines = (f: FormData, k: string) =>
  String(f.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function bookOf(form: FormData) {
  const book = String(form.get("book") ?? "");
  return isManualKey(book) ? book : null;
}

/** Up to two notes per task, which is as many as any of them has needed. */
function notesOf(form: FormData): Note[] {
  const out: Note[] = [];
  for (const n of [1, 2]) {
    const title = str(form, `note${n}_title`);
    const body = str(form, `note${n}_body`);
    if (!title || !body) continue;
    const kind = String(form.get(`note${n}_kind`) ?? "warn") === "stop" ? "stop" : "warn";
    out.push({ kind, title, body });
  }
  return out;
}

export async function saveIntro(_prev: unknown, form: FormData) {
  const user = await requireRole("super_admin");
  const book = bookOf(form);
  if (!book) return { error: "Unknown manual." };

  const headline = str(form, "headline");
  if (!headline) return { error: "Give the manual a headline." };

  await query(
    `INSERT INTO manual_intro (role, headline, intro, routine_title, routine_items, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (role) DO UPDATE
       SET headline = EXCLUDED.headline, intro = EXCLUDED.intro,
           routine_title = EXCLUDED.routine_title, routine_items = EXCLUDED.routine_items,
           updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [book, headline, lines(form, "intro"),
     str(form, "routine_title") ?? "Every day", lines(form, "routine_items"), user.uid],
  );

  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: "Opening saved." };
}

export async function saveTask(_prev: unknown, form: FormData) {
  const user = await requireRole("super_admin");
  const book = bookOf(form);
  if (!book) return { error: "Unknown manual." };

  const id = form.get("id") ? Number(form.get("id")) : null;
  const title = str(form, "title");
  const steps = lines(form, "steps");
  if (!title) return { error: "Give the step a title." };
  if (steps.length === 0) return { error: "A task needs at least one step." };

  const values = [
    title, str(form, "why"), lines(form, "path"), steps,
    JSON.stringify(notesOf(form)), str(form, "shot"),
    form.get("super_admin_only") === "on", user.uid,
  ];

  if (id) {
    await query(
      `UPDATE manual_tasks
          SET title=$2, why=$3, path=$4, steps=$5, notes=$6::jsonb, shot=$7,
              super_admin_only=$8, updated_by=$9, updated_at=now()
        WHERE id=$1`,
      [id, ...values]);
  } else {
    const last = await one<{ n: number | null }>(
      "SELECT max(position) AS n FROM manual_tasks WHERE role = $1", [book]);
    await query(
      `INSERT INTO manual_tasks
         (role, position, title, why, path, steps, notes, shot, super_admin_only, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [book, (last?.n ?? -1) + 1, ...values]);
  }

  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: id ? "Step saved." : "Step added." };
}

export async function deleteTask(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  await query("DELETE FROM manual_tasks WHERE id = $1", [Number(form.get("id"))]);
  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: "Step removed." };
}

/** Swaps a task with its neighbour, which is all reordering ever needs to be. */
export async function moveTask(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  const id = Number(form.get("id"));
  const up = String(form.get("direction")) === "up";

  const me = await one<{ role: string; position: number }>(
    "SELECT role, position FROM manual_tasks WHERE id = $1", [id]);
  if (!me) return { error: "Step not found." };

  const neighbour = await one<{ id: number; position: number }>(
    `SELECT id, position FROM manual_tasks
      WHERE role = $1 AND position ${up ? "<" : ">"} $2
      ORDER BY position ${up ? "DESC" : "ASC"} LIMIT 1`,
    [me.role, me.position]);
  if (!neighbour) return { ok: "Already at the end." };

  await query("UPDATE manual_tasks SET position = $2 WHERE id = $1", [id, neighbour.position]);
  await query("UPDATE manual_tasks SET position = $2 WHERE id = $1", [neighbour.id, me.position]);

  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: "Moved." };
}

export async function savePitfall(_prev: unknown, form: FormData) {
  const user = await requireRole("super_admin");
  const book = bookOf(form);
  if (!book) return { error: "Unknown manual." };

  const id = form.get("id") ? Number(form.get("id")) : null;
  const problem = str(form, "problem");
  const meaning = str(form, "meaning");
  if (!problem || !meaning) return { error: "Both the message and what it means are needed." };

  if (id) {
    await query(
      `UPDATE manual_pitfalls SET problem=$2, meaning=$3, updated_by=$4, updated_at=now()
        WHERE id=$1`, [id, problem, meaning, user.uid]);
  } else {
    const last = await one<{ n: number | null }>(
      "SELECT max(position) AS n FROM manual_pitfalls WHERE role = $1", [book]);
    await query(
      `INSERT INTO manual_pitfalls (role, position, problem, meaning, updated_by)
       VALUES ($1,$2,$3,$4,$5)`,
      [book, (last?.n ?? -1) + 1, problem, meaning, user.uid]);
  }

  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: id ? "Saved." : "Added." };
}

export async function deletePitfall(_prev: unknown, form: FormData) {
  await requireRole("super_admin");
  await query("DELETE FROM manual_pitfalls WHERE id = $1", [Number(form.get("id"))]);
  revalidatePath("/manage/manual");
  revalidatePath("/manual");
  return { ok: "Removed." };
}
