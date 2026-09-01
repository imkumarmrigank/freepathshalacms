import { NextResponse } from "next/server";
import { ping } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness probe that actually touches the database, unlike the login page. */
export async function GET() {
  try {
    const ms = await ping();
    return NextResponse.json({ ok: true, dbLatencyMs: ms });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
}
