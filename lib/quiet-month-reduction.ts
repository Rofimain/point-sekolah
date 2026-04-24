import { prisma } from "@/lib/prisma";
import {
  getEffectivePointsBreakdown,
  isPointAdjustmentTableMissing,
  QUIET_MONTH_REASON,
  quietPeriodMs,
} from "@/lib/student-effective-points";

export async function getLastViolationDate(studentId: string): Promise<Date | null> {
  const last = await prisma.violationRecord.findFirst({
    where: { studentId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return last?.date ?? null;
}

async function getLastQuietMonthAdjustmentDate(studentId: string): Promise<Date | null> {
  try {
    const last = await prisma.pointAdjustment.findFirst({
      where: { studentId, reason: QUIET_MONTH_REASON },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return last?.createdAt ?? null;
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return null;
    throw e;
  }
}

/**
 * Layak dipotong 25% bila:
 * - Ada poin pelanggaran (bruto) > 0
 * - Tidak ada catatan baru selama minimal `POINT_REDUCTION_QUIET_DAYS` (default 30) sejak pelanggaran terakhir
 * - Belum ada potongan "bulan tenang" yang diterapkan sejak pelanggaran terakhir itu
 */
export async function isEligibleForQuietMonthReduction(
  studentId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { gross } = await getEffectivePointsBreakdown(studentId);
  if (gross < 1) return false;

  const lastVio = await getLastViolationDate(studentId);
  if (!lastVio) return false;

  if (now.getTime() - lastVio.getTime() < quietPeriodMs()) return false;

  const lastAdj = await getLastQuietMonthAdjustmentDate(studentId);
  if (lastAdj && lastAdj.getTime() >= lastVio.getTime()) return false;

  return true;
}

export type QuietMonthApplyResult = {
  studentId: string;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
};

/**
 * Terapkan pengurangan 25% dari total poin bruto (bukan dari poin efektif).
 * Mengembalikan null jika tidak layak.
 */
export async function applyQuietMonthReductionForStudent(
  studentId: string,
  now: Date = new Date()
): Promise<QuietMonthApplyResult | null> {
  if (!(await isEligibleForQuietMonthReduction(studentId, now))) return null;

  const grossAgg = await prisma.violationRecord.aggregate({
    where: { studentId },
    _sum: { points: true },
  });
  const gross = grossAgg._sum.points ?? 0;
  if (gross < 1) return null;

  const deduct = Math.round(gross * 0.25);
  if (deduct < 1) return null;

  const pointsDelta = -Math.min(deduct, gross);

  try {
    await prisma.pointAdjustment.create({
      data: {
        studentId,
        pointsDelta,
        reason: QUIET_MONTH_REASON,
        grossTotalBefore: gross,
      },
    });
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return null;
    throw e;
  }

  const { effective } = await getEffectivePointsBreakdown(studentId);
  return {
    studentId,
    grossTotalBefore: gross,
    pointsDelta,
    effectiveAfter: effective,
  };
}

export async function applyQuietMonthReductionForAllStudents(
  now: Date = new Date()
): Promise<QuietMonthApplyResult[]> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", active: true },
    select: { id: true },
  });
  const out: QuietMonthApplyResult[] = [];
  for (const s of students) {
    const r = await applyQuietMonthReductionForStudent(s.id, now);
    if (r) out.push(r);
  }
  return out;
}
