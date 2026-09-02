import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Photographs are only served to somebody signed in. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const row = await one<{ mime: string; bytes: Buffer }>(
    "SELECT mime, bytes FROM media WHERE id = $1", [Number(id)]);
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      // immutable: a media row is never rewritten, only replaced by a new one
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
