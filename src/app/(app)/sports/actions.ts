"use server";
import { revalidatePath } from "next/cache";
import { canTouchCenter, requireUser, type SessionUser } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { can } from "@/lib/roles";
import { today } from "@/lib/format";
import { isSpecialLevel } from "@/lib/sports-meta";

type Result = { error?: string; ok?: string };

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

/** Anyone who runs sports, at a centre they may reach. Returns the sport or an error. */
async function reach(user: SessionUser, sportId: number) {
  if (!can(user.role, "sports")) return { error: "Sports are run by the sports teacher." } as const;
  const sport = await one<{ id: number; center_id: number; name: string }>(
    "SELECT id, center_id, name FROM sports WHERE id = $1", [sportId]);
  if (!sport) return { error: "That sport could not be found." } as const;
  if (!canTouchCenter(user, sport.center_id))
    return { error: "That sport belongs to another centre." } as const;
  return { sport } as const;
}

const touched = (sportId: number) => {
  revalidatePath("/sports");
  revalidatePath(`/sports/${sportId}`);
};

/* ------------------------------------------------------------------ sports */

export async function addSport(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  if (!can(user.role, "sports")) return { error: "Sports are run by the sports teacher." };

  const centerId = Number(form.get("center_id"));
  const name = str(form, "name");
  if (!centerId) return { error: "Choose the centre first." };
  if (!canTouchCenter(user, centerId)) return { error: "That centre is not one of yours." };
  if (!name || name.length < 2) return { error: "Give the sport a name." };
  if (name.length > 60) return { error: "Keep the name short — under 60 letters." };

  const clash = await one<{ id: number; is_active: boolean }>(
    "SELECT id, is_active FROM sports WHERE center_id = $1 AND lower(name) = lower($2)",
    [centerId, name]);
  if (clash?.is_active) return { error: `${name} is already played at this centre.` };
  if (clash) {
    // brought back rather than duplicated, so its players and history return with it
    await query("UPDATE sports SET is_active = TRUE WHERE id = $1", [clash.id]);
    touched(clash.id);
    return { ok: `${name} is back on at this centre.` };
  }

  await query(
    `INSERT INTO sports (center_id, name, description, created_by) VALUES ($1,$2,$3,$4)`,
    [centerId, name, str(form, "description"), user.uid]);
  revalidatePath("/sports");
  return { ok: `${name} added.` };
}

/** Stop a game without losing its record — the reports still need it. */
export async function setSportActive(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };
  const active = form.get("active") === "1";
  await query("UPDATE sports SET is_active = $2 WHERE id = $1", [got.sport.id, active]);
  touched(got.sport.id);
  return { ok: active ? `${got.sport.name} restarted.` : `${got.sport.name} paused.` };
}

/* ----------------------------------------------------------------- players */

export async function addPlayers(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };

  const ids = form.getAll("student_id").map(Number).filter(Boolean);
  if (ids.length === 0) return { error: "Tick the children who are joining." };

  // Only children of this centre, whatever the form sent.
  const rows = await query<{ id: number }>(
    "SELECT id FROM students WHERE id = ANY($1::bigint[]) AND center_id = $2 AND status = 'active'",
    [ids, got.sport.center_id]);
  if (rows.length === 0) return { error: "None of those children are at this centre." };

  await query(
    `INSERT INTO sport_students (sport_id, student_id, added_by)
     SELECT $1, unnest($2::bigint[]), $3
     ON CONFLICT (sport_id, student_id) DO UPDATE
       SET left_on = NULL, joined_on = CURRENT_DATE, added_by = EXCLUDED.added_by
       WHERE sport_students.left_on IS NOT NULL`,
    [got.sport.id, rows.map((r) => r.id), user.uid]);
  touched(got.sport.id);
  return { ok: `${rows.length} ${rows.length === 1 ? "child" : "children"} added to ${got.sport.name}.` };
}

/** A child who stops playing leaves the list; their attendance and marks stay. */
export async function removePlayer(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };
  await query(
    `UPDATE sport_students SET left_on = CURRENT_DATE
      WHERE sport_id = $1 AND student_id = $2 AND left_on IS NULL`,
    [got.sport.id, Number(form.get("student_id"))]);
  touched(got.sport.id);
  return { ok: "Taken off the list." };
}

/* -------------------------------------------------------------- attendance */

export async function saveSportAttendance(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };

  const date = str(form, "att_date") ?? today();
  if (date > today()) return { error: "Attendance cannot be marked for a future date." };

  const marks: { studentId: number; status: string }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("st_")) continue;
    const status = String(v);
    if (status !== "present" && status !== "absent") continue;
    marks.push({ studentId: Number(k.slice(3)), status });
  }
  if (marks.length === 0) return { error: "Mark at least one child." };

  // Only the children actually on this sport's list are written.
  await query(
    `INSERT INTO sport_attendance (sport_id, student_id, att_date, status, marked_by)
     SELECT $1, m.student_id, $2, m.status, $3
       FROM unnest($4::bigint[], $5::text[]) AS m(student_id, status)
       JOIN sport_students ss ON ss.sport_id = $1 AND ss.student_id = m.student_id
     ON CONFLICT (sport_id, student_id, att_date) DO UPDATE
       SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
    [got.sport.id, date, user.uid, marks.map((m) => m.studentId), marks.map((m) => m.status)]);

  touched(got.sport.id);
  const present = marks.filter((m) => m.status === "present").length;
  return { ok: `Saved — ${present} present, ${marks.length - present} absent.` };
}

/* ------------------------------------------------------------ tests, marks */

export async function createSportTest(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };

  const title = str(form, "title");
  const date = str(form, "test_date") ?? today();
  const max = Number(form.get("max_marks"));
  if (!title) return { error: "Name the test — for example “50 m sprint” or “Raid skills”." };
  if (!Number.isFinite(max) || max <= 0 || max > 1000) return { error: "Give the maximum marks." };

  await query(
    `INSERT INTO sport_tests (sport_id, title, test_date, max_marks, created_by)
     VALUES ($1,$2,$3,$4,$5)`,
    [got.sport.id, title, date, max, user.uid]);
  touched(got.sport.id);
  return { ok: `${title} set up. Open it to enter the marks.` };
}

export async function saveSportMarks(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const testId = Number(form.get("test_id"));
  const test = await one<{ id: number; sport_id: number; max_marks: string }>(
    "SELECT id, sport_id, max_marks FROM sport_tests WHERE id = $1", [testId]);
  if (!test) return { error: "That test could not be found." };
  const got = await reach(user, test.sport_id);
  if ("error" in got) return { error: got.error };
  const max = Number(test.max_marks);

  const rows: { id: number; marks: number | null; absent: boolean; remarks: string | null }[] = [];
  // Walk the list of children the sheet showed, not the marks boxes: a child
  // ticked absent has a disabled marks box, which the browser does not send.
  for (const pid of form.getAll("pid")) {
    const id = Number(pid);
    if (!id) continue;
    const raw = String(form.get(`m_${id}`) ?? "").trim();
    const absent = form.get(`ab_${id}`) === "on";
    const remarks = str(form, `rm_${id}`);
    if (!absent && raw === "" && !remarks) continue;          // nothing to record yet
    const marks = absent || raw === "" ? null : Number(raw);
    if (marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > max))
      return { error: `Marks must be between 0 and ${max}.` };
    rows.push({ id, marks, absent, remarks });
  }

  await tx(async (c) => {
    for (const r of rows) {
      await c.query(
        `INSERT INTO sport_marks (test_id, student_id, marks, is_absent, remarks, marked_by)
         SELECT $1, $2, $3, $4, $5, $6
          WHERE EXISTS (SELECT 1 FROM sport_students
                         WHERE sport_id = $7 AND student_id = $2)
         ON CONFLICT (test_id, student_id) DO UPDATE
           SET marks = EXCLUDED.marks, is_absent = EXCLUDED.is_absent,
               remarks = EXCLUDED.remarks, marked_by = EXCLUDED.marked_by, marked_at = now()`,
        [test.id, r.id, r.marks, r.absent, r.remarks, user.uid, test.sport_id]);
    }
  });

  touched(test.sport_id);
  revalidatePath(`/sports/${test.sport_id}/tests/${test.id}`);
  return { ok: `Marks saved for ${rows.length} ${rows.length === 1 ? "child" : "children"}.` };
}

/* ------------------------------------------------------------------ talent */

export async function markSpeciality(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };

  const studentId = Number(form.get("student_id"));
  const special = form.get("is_special") === "on";
  const speciality = str(form, "speciality");
  const level = str(form, "special_level");
  if (special && !speciality)
    return { error: "Say what the child is good at — “fast raider”, “long jump”…" };
  if (level && !isSpecialLevel(level)) return { error: "Choose how far the talent could go." };

  const row = await one<{ id: number }>(
    `UPDATE sport_students
        SET is_special = $3,
            speciality = CASE WHEN $3 THEN $4 ELSE NULL END,
            special_level = CASE WHEN $3 THEN $5 ELSE NULL END,
            special_marked_by = $6, special_marked_at = now()
      WHERE sport_id = $1 AND student_id = $2 AND left_on IS NULL
      RETURNING id`,
    [got.sport.id, studentId, special, speciality, level, user.uid]);
  if (!row) return { error: "That child is not on this sport's list." };

  touched(got.sport.id);
  return { ok: special ? "Talent recorded." : "Talent mark removed." };
}

/* ----------------------------------------------------------------- remarks */

/** A note on a child in a sport. Blank clears it. */
export async function saveRemark(_prev: unknown, form: FormData): Promise<Result> {
  const user = await requireUser();
  const got = await reach(user, Number(form.get("sport_id")));
  if ("error" in got) return { error: got.error };
  const remarks = str(form, "remarks");
  if (remarks && remarks.length > 500) return { error: "Keep the remark under 500 letters." };

  const row = await one<{ id: number }>(
    `UPDATE sport_students
        SET remarks = $3, remarks_updated_at = now(), remarks_by = $4
      WHERE sport_id = $1 AND student_id = $2 AND left_on IS NULL
      RETURNING id`,
    [got.sport.id, Number(form.get("student_id")), remarks, user.uid]);
  if (!row) return { error: "That child is not on this sport's list." };
  touched(got.sport.id);
  return { ok: remarks ? "Remark saved." : "Remark cleared." };
}
