import { NextResponse } from "next/server";
import { closeRegisterUpToYesterday } from "@/lib/attendance";

/**
 * Nightly close-out. Point a Render cron job at this URL with the CRON_SECRET
 * header so unmarked days are auto-marked absent even if nobody opens the app.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  }
  const filled = await closeRegisterUpToYesterday();
  return NextResponse.json({ ok: true, autoAbsentRows: filled });
}
