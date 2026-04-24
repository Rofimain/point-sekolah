import { NextRequest, NextResponse } from "next/server";
import { applyQuietMonthReductionForAllStudents } from "@/lib/quiet-month-reduction";

/**
 * Jalankan penilaian pengurangan 25% (periode tenang tanpa pelanggaran baru).
 * Panggil dari cron (mis. Vercel Cron) dengan header: x-cron-secret: CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applied = await applyQuietMonthReductionForAllStudents();
  return NextResponse.json({
    ok: true,
    count: applied.length,
    applied,
  });
}
