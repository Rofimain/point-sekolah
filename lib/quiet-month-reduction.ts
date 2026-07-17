import { prisma } from "@/lib/prisma";
import {
  calendarDaysSinceIncident,
  dateInTimeZoneYmd,
  dateToYmdInput,
} from "@/lib/incident-date";
import {
  getEffectivePointsBreakdown,
  isPointAdjustmentTableMissing,
  QUIET_MONTH_REASON,
} from "@/lib/student-effective-points";
import { AUTO_REMISI_PERCENT } from "@/lib/remisi-rules";
import { getQuietPeriodDays } from "@/lib/app-settings";

/**
 * Tanggal KEJADIAN pelanggaran terakhir (kolom `date`), bukan `createdAt` / waktu input.
 */
export async function getLastViolationDate(studentId: string): Promise<Date | null> {
  const last = await prisma.violationRecord.findFirst({
    where: { studentId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true },
  });
  return last?.date ?? null;
}

async function getLastQuietMonthAdjustmentAt(studentId: string): Promise<Date | null> {
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
 * Aturan no.1 (otomatis, tidak perlu diatur):
 * - Ada poin pelanggaran (bruto) > 0
 * - ≥ 30 hari kalender tanpa pelanggaran sejak tanggal KEJADIAN terakhir
 * - Belum ada remisi periode tenang setelah tanggal kejadian terakhir
 * - Potongan 25% dari total skor pelanggaran bruto
 */
export async function isEligibleForQuietMonthReduction(
  studentId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { gross } = await getEffectivePointsBreakdown(studentId);
  if (gross < 1) return false;

  const lastVio = await getLastViolationDate(studentId);
  if (!lastVio) return false;

  const quietDays = await getQuietPeriodDays();
  const daysQuiet = calendarDaysSinceIncident(lastVio, now);
  if (!Number.isFinite(daysQuiet) || daysQuiet < quietDays) return false;

  const lastAdj = await getLastQuietMonthAdjustmentAt(studentId);
  if (lastAdj && dateInTimeZoneYmd(lastAdj) >= dateToYmdInput(lastVio)) return false;

  return true;
}

export type QuietMonthApplyResult = {
  studentId: string;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
  remisiPercent: number;
};

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

  const remisiPercent = AUTO_REMISI_PERCENT;
  const deduct = Math.round(gross * (remisiPercent / 100));
  if (deduct < 1) return null;

  const { effective } = await getEffectivePointsBreakdown(studentId);
  const pointsDelta = -Math.min(deduct, effective, gross);
  if (pointsDelta >= 0) return null;

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

  const after = await getEffectivePointsBreakdown(studentId);
  return {
    studentId,
    grossTotalBefore: gross,
    pointsDelta,
    effectiveAfter: after.effective,
    remisiPercent,
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

export async function previewEligibleQuietMonthStudents(
  now: Date = new Date()
): Promise<{ id: string; name: string; lastIncidentYmd: string; daysQuiet: number }[]> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const out: { id: string; name: string; lastIncidentYmd: string; daysQuiet: number }[] = [];
  for (const s of students) {
    if (!(await isEligibleForQuietMonthReduction(s.id, now))) continue;
    const last = await getLastViolationDate(s.id);
    if (!last) continue;
    out.push({
      id: s.id,
      name: s.name,
      lastIncidentYmd: dateToYmdInput(last),
      daysQuiet: calendarDaysSinceIncident(last, now),
    });
  }
  return out;
}
