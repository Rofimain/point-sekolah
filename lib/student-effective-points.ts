import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Alasan pengurangan 25% setelah ≥N hari tanpa pelanggaran baru */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";

/** DB belum di-migrate (mis. build Vercel sebelum `prisma migrate deploy`) */
export function isPointAdjustmentTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PointAdjustment"
  );
}

export function quietPeriodDays(): number {
  const n = parseInt(process.env.POINT_REDUCTION_QUIET_DAYS || "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function quietPeriodMs(): number {
  return quietPeriodDays() * 86400000;
}

export async function getGrossPointsByStudent(): Promise<Map<string, number>> {
  const rows = await prisma.violationRecord.groupBy({
    by: ["studentId"],
    _sum: { points: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.studentId, r._sum.points ?? 0);
  }
  return m;
}

export async function getAdjustmentSumByStudent(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  try {
    const rows = await prisma.pointAdjustment.groupBy({
      by: ["studentId"],
      _sum: { pointsDelta: true },
    });
    for (const r of rows) {
      m.set(r.studentId, r._sum.pointsDelta ?? 0);
    }
  } catch (e) {
    if (!isPointAdjustmentTableMissing(e)) throw e;
  }
  return m;
}

/** Poin efektif = jumlah poin catatan + penyesuaian (biasanya negatif). */
export async function getEffectivePointsMap(): Promise<Map<string, number>> {
  const [gross, adj] = await Promise.all([getGrossPointsByStudent(), getAdjustmentSumByStudent()]);
  const ids = new Set<string>();
  gross.forEach((_, id) => ids.add(id));
  adj.forEach((_, id) => ids.add(id));
  const out = new Map<string, number>();
  ids.forEach((id) => {
    const g = gross.get(id) ?? 0;
    const a = adj.get(id) ?? 0;
    out.set(id, Math.max(0, g + a));
  });
  return out;
}

export async function getEffectivePointsBreakdown(studentId: string): Promise<{
  gross: number;
  adjustmentSum: number;
  effective: number;
}> {
  const grossAgg = await prisma.violationRecord.aggregate({
    where: { studentId },
    _sum: { points: true },
  });
  const gross = grossAgg._sum.points ?? 0;
  let adjustmentSum = 0;
  try {
    const adjAgg = await prisma.pointAdjustment.aggregate({
      where: { studentId },
      _sum: { pointsDelta: true },
    });
    adjustmentSum = adjAgg._sum.pointsDelta ?? 0;
  } catch (e) {
    if (!isPointAdjustmentTableMissing(e)) throw e;
  }
  return { gross, adjustmentSum, effective: Math.max(0, gross + adjustmentSum) };
}
