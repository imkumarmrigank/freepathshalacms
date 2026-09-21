import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import { can } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Photographs and identity documents — a child's face, a parent's Aadhaar.
 * Served to people whose work includes the student record, and to whoever
 * uploaded the file; not to every account that can sign in.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = await one<{ mime: string; bytes: Buffer; uploaded_by: number | null }>(
    "SELECT mime, bytes, uploaded_by FROM media WHERE id = $1", [Number(id)]);
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (!can(user.role, "students") && row.uploaded_by !== user.uid)
    return new NextResponse("Forbidden", { status: 403 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      // immutable: a media row is never rewritten, only replaced by a new one
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
