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
import { parseIncidentDateYmd } from "@/lib/incident-date";

export type ManualRemisiApplyResult = {
  studentId: string;
  studentName: string;
  type: ManualRemisiType;
  percent: number;
  /** Skor pelanggaran dengan tanggal kejadian ≤ tanggal prestasi. */
  eligibleGross: number;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
  achievementYmd: string;
  reason: string;
};

/** Jumlah poin pelanggaran dengan tanggal kejadian ≤ asOf (inklusif). */
export async function getGrossPointsOnOrBefore(
  studentId: string,
  asOfYmd: string
): Promise<{ ok: true; eligibleGross: number; asOf: Date } | { ok: false; error: string }> {
  const parsed = parseIncidentDateYmd(asOfYmd);
  if (!parsed.ok) return parsed;

  const agg = await prisma.violationRecord.aggregate({
    where: {
      studentId,
      date: { lte: parsed.date },
    },
    _sum: { points: true },
  });

  return { ok: true, eligibleGross: agg._sum.points ?? 0, asOf: parsed.date };
}

export async function applyManualRemisiForStudent(input: {
  studentId: string;
  type: ManualRemisiType;
  /** YYYY-MM-DD — remisi hanya dari poin kejadian ≤ tanggal ini. */
  achievementYmd: string;
  customPercent?: number;
  multiplier?: number;
  customLabel?: string;
  note?: string;
}): Promise<{ ok: true; result: ManualRemisiApplyResult } | { ok: false; error: string }> {
  const def = getManualRemisiDef(input.type);
  if (!def) return { ok: false, error: "Jenis remisi/reward tidak dikenal" };

  const customLabel = input.customLabel?.trim() ?? "";
  if (def.requireCustomLabel && customLabel.length < 2) {
    return { ok: false, error: "Nama jenis remisi/reward wajib diisi (minimal 2 karakter)" };
  }

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

  const scoped = await getGrossPointsOnOrBefore(student.id, input.achievementYmd);
  if (!scoped.ok) return scoped;

  const { eligibleGross } = scoped;
  if (eligibleGross < 1) {
    return {
      ok: false,
      error: `Tidak ada poin pelanggaran pada/sebelum ${input.achievementYmd}. Poin setelah tanggal itu tidak ikut dihitung.`,
    };
  }

  const { gross, effective } = await getEffectivePointsBreakdown(student.id);
  if (effective < 1) {
    return { ok: false, error: "Poin efektif siswa sudah 0 — tidak ada yang bisa dikurangi" };
  }

  const deduct = Math.round(eligibleGross * (resolved.percent / 100));
  if (deduct < 1) {
    return { ok: false, error: "Pengurangan terlalu kecil (minimal 1 poin). Coba persen lebih besar." };
  }

  const pointsDelta = -Math.min(deduct, effective);
  const reason = buildManualRemisiReason(input.type, {
    note: input.note,
    customLabel: def.requireCustomLabel ? customLabel : undefined,
    achievementYmd: input.achievementYmd,
  });

  try {
    await prisma.pointAdjustment.create({
      data: {
        studentId: student.id,
        pointsDelta,
        reason,
        /** Basis yang dipakai untuk %: skor sampai tanggal prestasi. */
        grossTotalBefore: eligibleGross,
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
      eligibleGross,
      grossTotalBefore: gross,
      pointsDelta,
      effectiveAfter: after.effective,
      achievementYmd: input.achievementYmd,
      reason,
    },
  };
}
