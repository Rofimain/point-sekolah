import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyQuietMonthReductionForAllStudents } from "@/lib/quiet-month-reduction";

/**
 * Super admin: jalankan remisi 25% (sama logika dengan POST /api/cron/quiet-month-points).
 * Hanya memengaruhi siswa yang sudah ≥30 hari (atau POINT_REDUCTION_QUIET_DAYS) tanpa pelanggaran baru.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
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

  return NextResponse.json({
    ok: true,
    count: applied.length,
    applied: applied.map((a) => ({
      ...a,
      studentName: nameById.get(a.studentId) ?? a.studentId,
    })),
  });
}
