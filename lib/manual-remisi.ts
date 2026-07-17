import { prisma } from "@/lib/prisma";
import {
  getEffectivePointsBreakdown,
  isPointAdjustmentTableMissing,
} from "@/lib/student-effective-points";
import {
  buildManualRemisiReason,
  getManualRemisiDef,
  resolveManualRemisiPercent,
  type ManualRemisiType,
} from "@/lib/remisi-rules";

export type ManualRemisiApplyResult = {
  studentId: string;
  studentName: string;
  type: ManualRemisiType;
  percent: number;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
  reason: string;
};

export async function applyManualRemisiForStudent(input: {
  studentId: string;
  type: ManualRemisiType;
  customPercent?: number;
  multiplier?: number;
  note?: string;
}): Promise<{ ok: true; result: ManualRemisiApplyResult } | { ok: false; error: string }> {
  const def = getManualRemisiDef(input.type);
  if (!def) return { ok: false, error: "Jenis remisi/reward tidak dikenal" };

  const resolved = resolveManualRemisiPercent(input.type, {
    customPercent: input.customPercent,
    multiplier: input.multiplier,
  });
  if (!resolved.ok) return resolved;

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, role: "STUDENT", active: true },
    select: { id: true, name: true },
  });
  if (!student) return { ok: false, error: "Siswa tidak ditemukan atau tidak aktif" };

  const { gross, effective } = await getEffectivePointsBreakdown(student.id);
  if (gross < 1) {
    return { ok: false, error: "Siswa belum punya skor pelanggaran (bruto 0)" };
  }
  if (effective < 1) {
    return { ok: false, error: "Poin efektif siswa sudah 0 — tidak ada yang bisa dikurangi" };
  }

  const deduct = Math.round(gross * (resolved.percent / 100));
  if (deduct < 1) {
    return { ok: false, error: "Pengurangan terlalu kecil (minimal 1 poin). Coba persen lebih besar." };
  }

  const pointsDelta = -Math.min(deduct, effective);
  const reason = buildManualRemisiReason(input.type, input.note);

  try {
    await prisma.pointAdjustment.create({
      data: {
        studentId: student.id,
        pointsDelta,
        reason,
        grossTotalBefore: gross,
      },
    });
  } catch (e) {
    if (isPointAdjustmentTableMissing(e)) {
      return { ok: false, error: "Tabel penyesuaian poin belum tersedia (jalankan migrasi DB)" };
    }
    throw e;
  }

  const after = await getEffectivePointsBreakdown(student.id);
  return {
    ok: true,
    result: {
      studentId: student.id,
      studentName: student.name,
      type: input.type,
      percent: resolved.percent,
      grossTotalBefore: gross,
      pointsDelta,
      effectiveAfter: after.effective,
      reason,
    },
  };
}
