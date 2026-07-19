import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredAccessLogs } from "@/lib/access-log-purge";

/**
 * Purge AccessLog & AuthLoginEvent lebih tua dari 12 bulan.
 * Compose cron atau: curl -X POST -H "x-cron-secret: $CRON_SECRET" .../api/cron/access-log-purge
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await purgeExpiredAccessLogs();
  return NextResponse.json({ ok: true, ...result });
}
