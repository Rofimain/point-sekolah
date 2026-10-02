import { NextRequest, NextResponse } from "next/server";
import { reconcileAutoRemisiForAllStudents } from "@/lib/quiet-month-reduction";

/**
 * Remisi otomatis berantai: tiap bulan kalender sejak tanggal KEJADIAN, 25% dari poin efektif.
 * Compose service `cron` atau curl POST + header x-cron-secret: CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await reconcileAutoRemisiForAllStudents();
  if (result.skipped) {
    return NextResponse.json({ ok: true, skipped: "belum diaktifkan", count: 0 });
  }
  return NextResponse.json({
    ok: true,
    count: result.created,
    created: result.created,
    reversed: result.reversed,
    students: result.count,
  });
}
