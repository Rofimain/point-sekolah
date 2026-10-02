import { prisma } from "@/lib/prisma";
import { calendarTodayYmd, dateInTimeZoneYmd, dateToYmdInput } from "@/lib/incident-date";
import { computeRemisiPlan, type RemisiAdjustmentInput } from "@/lib/remisi-chain";
import { APP_KEYS } from "@/lib/app-setting-keys";
import { getAppSetting } from "@/lib/app-settings";
import { reconcileAutoRemisiForAllStudents } from "@/lib/quiet-month-reduction";
import { accessLogActorFromSession, recordAccessLog } from "@/lib/access-log";

export type InitialRemisiRow = {
  nama: string;
  kelas: string | null;
  poinSekarang: number;
  tahap: number[];
  tanggalDue: string[];
  totalPotongan: number;
  poinAkhir: number;
};

function mapAdj(a: {
  id: string;
  reason: string;
  pointsDelta: number;
  effectiveDate: Date | null;
  createdAt: Date;
  reversalOfId: string | null;
}): RemisiAdjustmentInput {
  return {
    id: a.id,
    reason: a.reason,
    pointsDelta: a.pointsDelta,
    effectiveYmd: a.effectiveDate ? dateInTimeZoneYmd(a.effectiveDate) : dateInTimeZoneYmd(a.createdAt),
    createdYmd: dateInTimeZoneYmd(a.createdAt),
    reversalOfId: a.reversalOfId,
  };
}

export async function previewInitialRemisi(): Promise<{ aktif: boolean; rows: InitialRemisiRow[] }> {
  const aktif = (await getAppSetting(APP_KEYS.REMISI_BERANTAI_AKTIF)) === "1";
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, class: { select: { name: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  if (students.length === 0) return { aktif, rows: [] };

  const ids = students.map((s) => s.id);
  const [records, adjustments] = await Promise.all([
    prisma.violationRecord.findMany({
      where: { studentId: { in: ids }, deletedAt: null },
      select: { studentId: true, date: true, points: true },
    }),
    prisma.pointAdjustment.findMany({
      where: { studentId: { in: ids } },
      select: {
        id: true,
        studentId: true,
        reason: true,
        pointsDelta: true,
        effectiveDate: true,
        createdAt: true,
        reversalOfId: true,
      },
    }),
  ]);

  const recBy = new Map<string, { ymd: string; points: number }[]>();
  for (const r of records) {
    const list = recBy.get(r.studentId) ?? [];
    list.push({ ymd: dateToYmdInput(r.date), points: r.points });
    recBy.set(r.studentId, list);
  }
  const adjBy = new Map<string, RemisiAdjustmentInput[]>();
  const adjSum = new Map<string, number>();
  for (const a of adjustments) {
    const list = adjBy.get(a.studentId) ?? [];
    list.push(mapAdj(a));
    adjBy.set(a.studentId, list);
    adjSum.set(a.studentId, (adjSum.get(a.studentId) ?? 0) + a.pointsDelta);
  }

  const todayYmd = calendarTodayYmd();
  const rows: InitialRemisiRow[] = [];
  for (const s of students) {
    const incidents = recBy.get(s.id) ?? [];
    const adjs = adjBy.get(s.id) ?? [];
    if (incidents.length === 0 && adjs.length === 0) continue;
    const plan = computeRemisiPlan({ incidents, adjustments: adjs, todayYmd });
    if (plan.toCreate.length === 0 && plan.toReverse.length === 0) continue;
    const gross = incidents.reduce((sum, i) => sum + i.points, 0);
    const poinSekarang = Math.max(0, gross + (adjSum.get(s.id) ?? 0));
    const totalPotongan = plan.toCreate.reduce((sum, c) => sum + c.pointsDelta, 0);
    const restored = plan.toReverse.reduce((sum, r) => sum + r.pointsDelta, 0);
    rows.push({
      nama: s.name,
      kelas: s.class?.name ?? null,
      poinSekarang,
      tahap: plan.toCreate.map((c) => c.step),
      tanggalDue: plan.toCreate.map((c) => c.dueYmd),
      totalPotongan,
      poinAkhir: Math.max(0, poinSekarang + totalPotongan + restored),
    });
  }
  return { aktif, rows };
}

export async function applyInitialRemisi(session: {
  user?: { id?: string | null; name?: string | null; role?: string | null } | null;
}): Promise<{ ok: true; created: number; reversed: number; count: number } | { ok: false; error: string }> {
  const current = await getAppSetting(APP_KEYS.REMISI_BERANTAI_AKTIF);
  if (current === "1") return { ok: false, error: "Remisi berantai sudah diaktifkan." };

  await prisma.appSetting.upsert({
    where: { key: APP_KEYS.REMISI_BERANTAI_AKTIF },
    create: { key: APP_KEYS.REMISI_BERANTAI_AKTIF, value: "1" },
    update: { value: "1" },
  });

  const result = await reconcileAutoRemisiForAllStudents();
  await recordAccessLog({
    portal: "STAFF",
    category: "DATA",
    action: "REMISI_BERANTAI_AKTIVASI",
    actor: accessLogActorFromSession(session),
    summary: `Aktivasi remisi berantai: ${result.created} tahap dibuat, ${result.reversed} dibatalkan (${result.count} siswa).`,
    targetType: "AppSetting",
    targetId: APP_KEYS.REMISI_BERANTAI_AKTIF,
  });
  return { ok: true, created: result.created, reversed: result.reversed, count: result.count };
}
