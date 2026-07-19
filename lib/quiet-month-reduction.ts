import { prisma } from "@/lib/prisma";
import { calendarDaysSinceIncident, dateToYmdInput } from "@/lib/incident-date";
import { isPointAdjustmentTableMissing, getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import {
  buildQuietMonthReason,
  isQuietMonthReason,
  parseQuietMonthAnchor,
  QUIET_MONTH_REASON,
} from "@/lib/point-adjustment-reason";
import { AUTO_REMISI_PERCENT } from "@/lib/remisi-rules";
import { getQuietPeriodDays } from "@/lib/app-settings";
import { findUnclaimedQuietGaps, isLastWindowClaimed } from "@/lib/quiet-month-gaps";

export type { QuietGap } from "@/lib/quiet-month-gaps";
export { findUnclaimedQuietGaps, isLastWindowClaimed } from "@/lib/quiet-month-gaps";

/**
 * Tanggal KEJADIAN pelanggaran terakhir (kolom `date`), bukan `createdAt` / waktu input.
 */
export async function getLastViolationDate(studentId: string): Promise<Date | null> {
  const last = await prisma.violationRecord.findFirst({
    where: { studentId, deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true },
  });
  return last?.date ?? null;
}

async function listQuietMonthAdjustments(studentId: string): Promise<{ reason: string; createdAt: Date }[]> {
  try {
    const rows = await prisma.pointAdjustment.findMany({
      where: {
        studentId,
        OR: [{ reason: QUIET_MONTH_REASON }, { reason: { startsWith: `${QUIET_MONTH_REASON}|` } }],
      },
      select: { reason: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.filter((r) => isQuietMonthReason(r.reason));
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return [];
    throw e;
  }
}

function claimedAnchorsFromAdjustments(rows: { reason: string }[]): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    const a = parseQuietMonthAnchor(r.reason);
    if (a) set.add(a);
  }
  return set;
}

function legacyQuietAdjustments(rows: { reason: string; createdAt: Date }[]): { createdAt: Date }[] {
  return rows.filter((r) => parseQuietMonthAnchor(r.reason) == null).map((r) => ({ createdAt: r.createdAt }));
}

/**
 * Aturan no.1 (otomatis, tidak perlu diatur):
 * - Ada poin pelanggaran (bruto) > 0
 * - ≥ 30 hari kalender tanpa pelanggaran sejak tanggal KEJADIAN terakhir
 * - Belum ada remisi periode tenang untuk anchor kejadian terakhir
 * - Potongan 25% dari total skor pelanggaran bruto
 */
export async function isEligibleForQuietMonthReduction(studentId: string, now: Date = new Date()): Promise<boolean> {
  const info = await getQuietMonthCountdown(studentId, now);
  return info != null && info.daysRemaining === 0;
}

/** Info hitungan mundur remisi otomatis untuk UI siswa. `null` = tidak perlu ditampilkan. */
export async function getQuietMonthCountdown(
  studentId: string,
  now: Date = new Date()
): Promise<{ daysRemaining: number; quietDays: number; remisiPercent: number } | null> {
  const { gross } = await getEffectivePointsBreakdown(studentId);
  if (gross < 1) return null;

  const lastVio = await getLastViolationDate(studentId);
  if (!lastVio) return null;

  const lastVioYmd = dateToYmdInput(lastVio);
  const adj = await listQuietMonthAdjustments(studentId);
  if (
    isLastWindowClaimed({
      lastVioYmd,
      claimedAnchors: claimedAnchorsFromAdjustments(adj),
      legacyQuietAdjustments: legacyQuietAdjustments(adj),
    })
  ) {
    return null;
  }

  const quietDays = await getQuietPeriodDays();
  const daysQuiet = calendarDaysSinceIncident(lastVio, now);
  if (!Number.isFinite(daysQuiet)) return null;

  return {
    daysRemaining: Math.max(0, quietDays - daysQuiet),
    quietDays,
    remisiPercent: AUTO_REMISI_PERCENT,
  };
}

export type QuietMonthApplyResult = {
  studentId: string;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
  remisiPercent: number;
  anchorYmd: string;
};

async function createQuietAdjustment(opts: {
  studentId: string;
  anchorYmd: string;
  grossForPercent: number;
}): Promise<QuietMonthApplyResult | null> {
  const remisiPercent = AUTO_REMISI_PERCENT;
  const deduct = Math.round(opts.grossForPercent * (remisiPercent / 100));
  if (deduct < 1) return null;

  const { effective, gross: grossTotal } = await getEffectivePointsBreakdown(opts.studentId);
  const pointsDelta = -Math.min(deduct, effective, grossTotal);
  if (pointsDelta >= 0) return null;

  const reason = buildQuietMonthReason(opts.anchorYmd);
  try {
    await prisma.pointAdjustment.create({
      data: {
        studentId: opts.studentId,
        pointsDelta,
        reason,
        grossTotalBefore: opts.grossForPercent,
      },
    });
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return null;
    throw e;
  }

  const after = await getEffectivePointsBreakdown(opts.studentId);
  return {
    studentId: opts.studentId,
    grossTotalBefore: opts.grossForPercent,
    pointsDelta,
    effectiveAfter: after.effective,
    remisiPercent,
    anchorYmd: opts.anchorYmd,
  };
}

function grossThroughAnchor(records: { date: Date; points: number }[], anchorYmd: string): number {
  let sum = 0;
  for (const r of records) {
    if (dateToYmdInput(r.date) <= anchorYmd) sum += r.points;
  }
  return sum;
}

/**
 * Terapkan semua catch-up (jeda historis, tertua dulu) lalu jendela last→now bila eligible.
 * Mengembalikan penyesuaian terakhir yang berhasil (kompatibel seed/caller lama).
 */
export async function applyQuietMonthReductionForStudent(
  studentId: string,
  now: Date = new Date()
): Promise<QuietMonthApplyResult | null> {
  const applied = await applyAllQuietMonthReductionsForStudent(studentId, now);
  return applied.length > 0 ? applied[applied.length - 1]! : null;
}

export async function applyAllQuietMonthReductionsForStudent(
  studentId: string,
  now: Date = new Date()
): Promise<QuietMonthApplyResult[]> {
  const quietDays = await getQuietPeriodDays();
  const records = await prisma.violationRecord.findMany({
    where: { studentId, deletedAt: null },
    select: { date: true, points: true },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  if (records.length === 0) return [];

  const out: QuietMonthApplyResult[] = [];
  const adj = await listQuietMonthAdjustments(studentId);
  const claimed = claimedAnchorsFromAdjustments(adj);

  const ymds = records.map((r) => dateToYmdInput(r.date));
  const gaps = findUnclaimedQuietGaps({
    incidentYmds: ymds,
    claimedAnchors: claimed,
    quietDays,
  });

  for (const gap of gaps) {
    const grossForPercent = grossThroughAnchor(records, gap.anchorYmd);
    if (grossForPercent < 1) {
      claimed.add(gap.anchorYmd);
      continue;
    }
    const r = await createQuietAdjustment({
      studentId,
      anchorYmd: gap.anchorYmd,
      grossForPercent,
    });
    if (r) {
      out.push(r);
      claimed.add(gap.anchorYmd);
    }
  }

  if (await isEligibleForQuietMonthReduction(studentId, now)) {
    const lastVio = await getLastViolationDate(studentId);
    if (lastVio) {
      const lastVioYmd = dateToYmdInput(lastVio);
      if (!claimed.has(lastVioYmd)) {
        const grossAgg = await prisma.violationRecord.aggregate({
          where: { studentId, deletedAt: null },
          _sum: { points: true },
        });
        const gross = grossAgg._sum.points ?? 0;
        if (gross >= 1) {
          const r = await createQuietAdjustment({
            studentId,
            anchorYmd: lastVioYmd,
            grossForPercent: gross,
          });
          if (r) out.push(r);
        }
      }
    }
  }

  return out;
}

export async function applyQuietMonthReductionForAllStudents(now: Date = new Date()): Promise<QuietMonthApplyResult[]> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const out: QuietMonthApplyResult[] = [];
  for (const s of students) {
    const applied = await applyAllQuietMonthReductionsForStudent(s.id, now);
    out.push(...applied);
  }
  return out;
}

export async function previewEligibleQuietMonthStudents(
  now: Date = new Date()
): Promise<{ id: string; name: string; lastIncidentYmd: string; daysQuiet: number }[]> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (students.length === 0) return [];

  const quietDays = await getQuietPeriodDays();
  const studentIds = students.map((s) => s.id);

  const [allRecords, allAdj] = await Promise.all([
    prisma.violationRecord.findMany({
      where: { studentId: { in: studentIds }, deletedAt: null },
      select: { studentId: true, date: true, points: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.pointAdjustment
      .findMany({
        where: {
          studentId: { in: studentIds },
          OR: [{ reason: QUIET_MONTH_REASON }, { reason: { startsWith: `${QUIET_MONTH_REASON}|` } }],
        },
        select: { studentId: true, reason: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
      .catch((e) => {
        if (isPointAdjustmentTableMissing(e)) return [] as { studentId: string; reason: string; createdAt: Date }[];
        throw e;
      }),
  ]);

  const recordsByStudent = new Map<string, { date: Date; points: number }[]>();
  for (const r of allRecords) {
    const list = recordsByStudent.get(r.studentId) ?? [];
    list.push({ date: r.date, points: r.points });
    recordsByStudent.set(r.studentId, list);
  }

  const adjByStudent = new Map<string, { reason: string; createdAt: Date }[]>();
  for (const a of allAdj) {
    if (!isQuietMonthReason(a.reason)) continue;
    const list = adjByStudent.get(a.studentId) ?? [];
    list.push({ reason: a.reason, createdAt: a.createdAt });
    adjByStudent.set(a.studentId, list);
  }

  const out: { id: string; name: string; lastIncidentYmd: string; daysQuiet: number }[] = [];
  for (const s of students) {
    const records = recordsByStudent.get(s.id);
    if (!records?.length) continue;

    const adj = adjByStudent.get(s.id) ?? [];
    const claimed = claimedAnchorsFromAdjustments(adj);
    const ymds = records.map((r) => dateToYmdInput(r.date));
    const gaps = findUnclaimedQuietGaps({
      incidentYmds: ymds,
      claimedAnchors: claimed,
      quietDays,
    });

    if (gaps.length > 0) {
      const g = gaps[0]!;
      out.push({
        id: s.id,
        name: s.name,
        lastIncidentYmd: g.anchorYmd,
        daysQuiet: g.daysQuiet,
      });
      continue;
    }

    const gross = records.reduce((sum, r) => sum + r.points, 0);
    if (gross < 1) continue;

    const last = records.reduce((best, r) => (r.date > best ? r.date : best), records[0]!.date);
    const lastVioYmd = dateToYmdInput(last);
    if (
      isLastWindowClaimed({
        lastVioYmd,
        claimedAnchors: claimed,
        legacyQuietAdjustments: legacyQuietAdjustments(adj),
      })
    ) {
      continue;
    }

    const daysQuiet = calendarDaysSinceIncident(last, now);
    if (!Number.isFinite(daysQuiet)) continue;
    if (Math.max(0, quietDays - daysQuiet) !== 0) continue;

    out.push({
      id: s.id,
      name: s.name,
      lastIncidentYmd: lastVioYmd,
      daysQuiet,
    });
  }
  return out;
}
