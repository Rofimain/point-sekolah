import { prisma } from "@/lib/prisma";
import { calendarDaysBetweenYmd, calendarTodayYmd, dateInTimeZoneYmd, dateToYmdInput } from "@/lib/incident-date";
import { isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import {
  buildQuietMonthReason,
  buildQuietMonthReversalReason,
} from "@/lib/point-adjustment-reason";
import { autoRemisiIdsToRebuild, computeRemisiPlan, type RemisiAdjustmentInput } from "@/lib/remisi-chain";
import { APP_KEYS } from "@/lib/app-setting-keys";
import { getAppSetting } from "@/lib/app-settings";
import { recordAccessLog } from "@/lib/access-log";

export type ReconcileSummary = { created: number; reversed: number; rebuilt: number };

function ymdToUtcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0));
}

export async function isRemisiBerantaiAktif(): Promise<boolean> {
  try {
    return (await getAppSetting(APP_KEYS.REMISI_BERANTAI_AKTIF)) === "1";
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return false;
    throw e;
  }
}

async function loadPlanInput(studentId: string, db: Pick<typeof prisma, "violationRecord" | "pointAdjustment">) {
  const [records, adjustments] = await Promise.all([
    db.violationRecord.findMany({
      where: { studentId, deletedAt: null },
      select: { date: true, points: true },
    }),
    db.pointAdjustment.findMany({ where: { studentId } }),
  ]);
  const mapped: RemisiAdjustmentInput[] = adjustments.map((a) => ({
    id: a.id,
    reason: a.reason,
    pointsDelta: a.pointsDelta,
    effectiveYmd: a.effectiveDate ? dateInTimeZoneYmd(a.effectiveDate) : dateInTimeZoneYmd(a.createdAt),
    createdYmd: dateInTimeZoneYmd(a.createdAt),
    reversalOfId: a.reversalOfId,
  }));
  return {
    incidents: records.map((r) => ({ ymd: dateToYmdInput(r.date), points: r.points })),
    adjustments: mapped,
    todayYmd: calendarTodayYmd(),
  };
}

export async function reconcileAutoRemisiForStudent(
  studentId: string,
  opts?: { actorName?: string; rebuildAutoAfterYmd?: string }
): Promise<ReconcileSummary> {
  if (!(await isRemisiBerantaiAktif())) return { created: 0, reversed: 0, rebuilt: 0 };

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${studentId})::bigint)`;
      const input = await loadPlanInput(studentId, tx);
      let rebuilt = 0;
      if (opts?.rebuildAutoAfterYmd) {
        const ids = autoRemisiIdsToRebuild(input.adjustments, opts.rebuildAutoAfterYmd);
        if (ids.length > 0) {
          await tx.pointAdjustment.deleteMany({ where: { id: { in: ids } } });
          const drop = new Set(ids);
          input.adjustments = input.adjustments.filter((a) => !drop.has(a.id));
          rebuilt = ids.length;
        }
      }
      const plan = computeRemisiPlan(input);
      const todayYmd = input.todayYmd;

      for (const row of plan.toCreate) {
        await tx.pointAdjustment.create({
          data: {
            studentId,
            pointsDelta: row.pointsDelta,
            reason: buildQuietMonthReason(row.anchorYmd, row.step),
            grossTotalBefore: row.effectiveBefore,
            effectiveBefore: row.effectiveBefore,
            effectiveDate: ymdToUtcNoon(row.dueYmd),
            isBackfill: row.isBackfill,
            createdByName: opts?.actorName ?? null,
          },
        });
      }

      let running = 0;
      for (const inc of input.incidents) running += inc.points;
      for (const adj of input.adjustments) running += adj.pointsDelta;
      for (const row of plan.toCreate) running += row.pointsDelta;

      for (const rev of plan.toReverse) {
        const effectiveBefore = running;
        await tx.pointAdjustment.create({
          data: {
            studentId,
            pointsDelta: rev.pointsDelta,
            reason: buildQuietMonthReversalReason(rev.anchorYmd, rev.step, rev.sebab),
            grossTotalBefore: effectiveBefore,
            effectiveBefore,
            effectiveDate: ymdToUtcNoon(todayYmd),
            reversalOfId: rev.adjustmentId,
            isBackfill: false,
            createdByName: opts?.actorName ?? null,
          },
        });
        running += rev.pointsDelta;
      }

      return { plan, rebuilt };
    });

    if (outcome.plan.toReverse.length > 0) {
      const student = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true } });
      const sebab = outcome.plan.toReverse.map((r) => `tahap ${r.step} (${r.sebab})`).join("; ");
      await recordAccessLog({
        portal: opts?.actorName ? "STAFF" : "SYSTEM",
        category: "DATA",
        action: "REMISI_AUTO_REVERSAL",
        summary: `Pembatalan remisi otomatis ${student?.name ?? studentId}: ${sebab}`,
        targetType: "User",
        targetId: studentId,
        actor: opts?.actorName ? { name: opts.actorName } : null,
      });
    }

    return {
      created: outcome.plan.toCreate.length,
      reversed: outcome.plan.toReverse.length,
      rebuilt: outcome.rebuilt,
    };
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return { created: 0, reversed: 0, rebuilt: 0 };
    throw e;
  }
}

export async function reconcileAutoRemisiForAllStudents(): Promise<ReconcileSummary & { count: number; skipped: boolean }> {
  if (!(await isRemisiBerantaiAktif())) return { created: 0, reversed: 0, rebuilt: 0, count: 0, skipped: true };
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE", deletedAt: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  let created = 0;
  let reversed = 0;
  for (const s of students) {
    const one = await reconcileAutoRemisiForStudent(s.id);
    created += one.created;
    reversed += one.reversed;
  }
  return { created, reversed, rebuilt: 0, count: students.length, skipped: false };
}

export async function getRemisiCountdown(studentId: string): Promise<{
  nextDueYmd: string;
  step: number;
  daysRemaining: number;
  estimatedDelta: number;
} | null> {
  try {
    const input = await loadPlanInput(studentId, prisma);
    const plan = computeRemisiPlan(input);
    if (!plan.next) return null;
    return {
      nextDueYmd: plan.next.dueYmd,
      step: plan.next.step,
      daysRemaining: Math.max(0, calendarDaysBetweenYmd(input.todayYmd, plan.next.dueYmd)),
      estimatedDelta: Math.abs(plan.next.estimatedDelta),
    };
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) return null;
    throw e;
  }
}
