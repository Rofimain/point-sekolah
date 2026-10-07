import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import {
  buildManualRemisiReason,
  isDeletableManualRemisi,
  manualRemisiCutFromCurrentPoints,
  parseManualRemisiReason,
  resolveManualRemisiPercent,
} from "@/lib/remisi-rules";
import { dateInTimeZoneYmd, parseIncidentDateYmd } from "@/lib/incident-date";

export type ManualRemisiApplyResult = {
  studentId: string;
  studentName: string;
  percent: number;
  /** Skor pelanggaran dengan tanggal kejadian ≤ tanggal prestasi. */
  eligibleGross: number;
  grossTotalBefore: number;
  pointsDelta: number;
  effectiveAfter: number;
  achievementYmd: string;
  customLabel: string;
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
      deletedAt: null,
      date: { lte: parsed.date },
    },
    _sum: { points: true },
  });

  return { ok: true, eligibleGross: agg._sum.points ?? 0, asOf: parsed.date };
}

export async function applyManualRemisiForStudent(input: {
  studentId: string;
  /** YYYY-MM-DD — remisi hanya dari poin kejadian ≤ tanggal ini. */
  achievementYmd: string;
  customPercent: number;
  customLabel: string;
  note?: string;
  actorName?: string;
}): Promise<{ ok: true; result: ManualRemisiApplyResult } | { ok: false; error: string }> {
  const customLabel = input.customLabel.trim();
  if (customLabel.length < 2) {
    return { ok: false, error: "Nama jenis remisi/reward wajib diisi (minimal 2 karakter)" };
  }

  const resolved = resolveManualRemisiPercent(input.customPercent);
  if (!resolved.ok) return resolved;

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, role: "STUDENT", status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true },
  });
  if (!student) return { ok: false, error: "Siswa tidak ditemukan atau tidak aktif" };

  const scoped = await getGrossPointsOnOrBefore(student.id, input.achievementYmd);
  if (!scoped.ok) return scoped;

  const { eligibleGross } = scoped;
  if (eligibleGross < 1) {
    return {
      ok: false,
      error: `Tidak ada poin pelanggaran pada/sebelum ${input.achievementYmd}.`,
    };
  }

  const { effective } = await getEffectivePointsBreakdown(student.id);
  if (effective < 1) {
    return { ok: false, error: "Poin efektif siswa sudah 0 — tidak ada yang bisa dikurangi" };
  }

  const deduct = manualRemisiCutFromCurrentPoints(effective, resolved.percent);
  if (deduct < 1) {
    return { ok: false, error: "Pengurangan terlalu kecil (minimal 1 poin). Coba persen lebih besar." };
  }

  const pointsDelta = -deduct;
  const reason = buildManualRemisiReason({
    note: input.note,
    customLabel,
    achievementYmd: input.achievementYmd,
  });

  try {
    await prisma.pointAdjustment.create({
      data: {
        studentId: student.id,
        pointsDelta,
        reason,
        /** Basis yang dipakai untuk %: poin efektif saat remisi diinput. */
        grossTotalBefore: effective,
        effectiveBefore: effective,
        effectiveDate: new Date(),
        createdByName: input.actorName?.trim() || null,
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
      percent: resolved.percent,
      eligibleGross,
      grossTotalBefore: effective,
      pointsDelta,
      effectiveAfter: after.effective,
      achievementYmd: input.achievementYmd,
      customLabel,
      reason,
    },
  };
}

export type ManualRemisiDeleteResult = {
  id: string;
  studentId: string;
  studentName: string;
  label: string;
  /** Potongan yang dihapus (negatif, mis. -5). */
  pointsDelta: number;
  /** Poin yang benar-benar kembali ke saldo efektif, sebelum rekonsiliasi remisi otomatis. */
  pointsRestored: number;
  effectiveBefore: number;
  effectiveAfter: number;
  /** Tanggal kalender saat remisi manual ini berlaku. Remisi otomatis sesudah tanggal ini dihitung ulang. */
  effectiveYmd: string;
};

/** Hapus satu baris remisi manual. Remisi otomatis sesudah tanggal ini dihitung ulang oleh pemanggil. */
export async function deleteManualRemisiById(
  id: string
): Promise<{ ok: true; result: ManualRemisiDeleteResult } | { ok: false; error: string; status: number }> {
  const row = await prisma.pointAdjustment.findUnique({
    where: { id },
    include: { student: { select: { id: true, name: true } } },
  });
  if (!row) return { ok: false, error: "Remisi tidak ditemukan", status: 404 };
  if (!isDeletableManualRemisi(row.reason, row.reversalOfId)) {
    return { ok: false, error: "Hanya remisi manual yang bisa dihapus", status: 400 };
  }

  const before = await getEffectivePointsBreakdown(row.studentId);

  try {
    await prisma.pointAdjustment.delete({ where: { id: row.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "Remisi tidak ditemukan", status: 404 };
    }
    if (isPointAdjustmentTableMissing(e)) {
      return { ok: false, error: "Tabel penyesuaian poin belum tersedia (jalankan migrasi DB)", status: 500 };
    }
    throw e;
  }

  const after = await getEffectivePointsBreakdown(row.studentId);
  const parsed = parseManualRemisiReason(row.reason);
  return {
    ok: true,
    result: {
      id: row.id,
      studentId: row.studentId,
      studentName: row.student.name,
      label: parsed.customLabel?.trim() || "Remisi manual",
      pointsDelta: row.pointsDelta,
      pointsRestored: after.effective - before.effective,
      effectiveBefore: before.effective,
      effectiveAfter: after.effective,
      effectiveYmd: dateInTimeZoneYmd(row.effectiveDate ?? row.createdAt),
    },
  };
}
