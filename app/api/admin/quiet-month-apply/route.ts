import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyQuietMonthReductionForAllStudents } from "@/lib/quiet-month-reduction";
import { canManageData } from "@/lib/staff-roles";
import { recordDataAccessLog } from "@/lib/access-log";

/**
 * Super admin / admin: jalankan remisi (sama logika dengan POST /api/cron/quiet-month-points).
 * Layak bila sudah ≥ hari tenang (pengaturan sekolah / POINT_REDUCTION_QUIET_DAYS) sejak tanggal kejadian terakhir.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
