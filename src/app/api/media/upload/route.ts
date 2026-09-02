import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Photographs are stored in Postgres — Render's filesystem does not survive a deploy. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED.includes(file.type))
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP image." }, { status: 415 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "That photo is larger than 3 MB." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const row = await one<{ id: number }>(
    `INSERT INTO media (mime, byte_size, bytes, uploaded_by)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [file.type, bytes.length, bytes, user.uid],
  );
  return NextResponse.json({ id: row!.id, url: `/api/media/${row!.id}` });
}
