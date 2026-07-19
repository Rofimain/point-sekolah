import { NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { applyQuietMonthReductionForAllStudents } from "@/lib/quiet-month-reduction";
import { recordDataAccessLog } from "@/lib/access-log";

/**
 * Super admin / admin: jalankan remisi (sama logika dengan POST /api/cron/quiet-month-points).
 * Termasuk catch-up jeda historis antar kejadian (≥ hari tenang) dan jendela last→now.
 */
export async function POST() {
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const applied = await applyQuietMonthReductionForAllStudents();
  const names =
    applied.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: applied.map((a) => a.studentId) } },
          select: { id: true, name: true },
        });
  const nameById = new Map(names.map((u) => [u.id, u.name]));

  await recordDataAccessLog({
    session,
    action: "REMISI_QUIET_MONTH",
    summary: `Terapkan remisi periode tenang ke ${applied.length} siswa`,
    targetType: "PointAdjustment",
    meta: { count: applied.length },
  });

  return NextResponse.json({
    ok: true,
    count: applied.length,
    applied: applied.map((a) => ({
      ...a,
      studentName: nameById.get(a.studentId) ?? a.studentId,
    })),
  });
}
