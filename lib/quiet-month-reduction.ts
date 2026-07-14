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
  quietPeriodDays,
} from "@/lib/student-effective-points";

/**
 * Tanggal KEJADIAN pelanggaran terakhir (kolom `date`), bukan `createdAt` / waktu input.
 * Input terlambat harus mengisi tanggal kejadian yang benar di form.
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
 * Layak dipotong 25% bila:
 * - Ada poin pelanggaran (bruto) > 0
 * - Sudah lewat minimal `POINT_REDUCTION_QUIET_DAYS` (default 30) **hari kalender**
 *   sejak tanggal KEJADIAN pelanggaran terakhir (`ViolationRecord.date`) — bukan sejak diinput
 * - Belum ada potongan "bulan tenang" setelah tanggal kejadian terakhir itu
 */
export async function isEligibleForQuietMonthReduction(
  studentId: string,
  now: Date = new Date()
): Promise<boolean> {
  const { gross } = await getEffectivePointsBreakdown(studentId);
  if (gross < 1) return false;

  const lastVio = await getLastViolationDate(studentId);
  if (!lastVio) return false;

  const daysQuiet = calendarDaysSinceIncident(lastVio, now);
  if (!Number.isFinite(daysQuiet) || daysQuiet < quietPeriodDays()) return false;

  const lastAdj = await getLastQuietMonthAdjustmentAt(studentId);
  // Sudah pernah remisi setelah (atau pada hari) tanggal kejadian terakhir → jangan ulang
  if (lastAdj && dateInTimeZoneYmd(lastAdj) >= dateToYmdInput(lastVio)) return false;

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

/** Daftar siswa yang saat ini memenuhi syarat remisi 25% (belum diterapkan). */
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
