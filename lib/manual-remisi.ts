import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import {
  balanceBeforeManualRemisi,
  buildManualRemisiReason,
  isDeletableManualRemisi,
  manualRemisiCutFromCurrentPoints,
  parseManualRemisiReason,
  resolveManualRemisiPercent,
} from "@/lib/remisi-rules";
import { calendarTodayYmd, dateInTimeZoneYmd, dateToYmdInput, parseIncidentDateYmd } from "@/lib/incident-date";

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

function adjustmentInstant(row: { effectiveDate: Date | null; createdAt: Date }): Date {
  return row.effectiveDate ?? row.createdAt;
}

/** Poin pada saat remisi manual ini diinput, tanpa baris ini dan tanpa kejadian sesudahnya. */
export async function balanceAtManualRemisi(row: {
  id: string;
  studentId: string;
  effectiveDate: Date | null;
  createdAt: Date;
}): Promise<number> {
  const at = adjustmentInstant(row);
  const [violations, adjustments] = await Promise.all([
    prisma.violationRecord.findMany({
      where: { studentId: row.studentId, deletedAt: null },
      select: { date: true, points: true },
    }),
    prisma.pointAdjustment.findMany({
      where: { studentId: row.studentId },
      select: { id: true, pointsDelta: true, effectiveDate: true, createdAt: true },
    }),
  ]);
  return balanceBeforeManualRemisi({
    violations: violations.map((v) => ({ ymd: dateToYmdInput(v.date), points: v.points })),
    adjustments: adjustments.map((a) => ({
      id: a.id,
      atMs: adjustmentInstant(a).getTime(),
      pointsDelta: a.pointsDelta,
    })),
    remisiId: row.id,
    remisiAtMs: at.getTime(),
    remisiYmd: dateInTimeZoneYmd(at),
  });
}

export type ManualRemisiEditResult = {
  id: string;
  studentId: string;
  studentName: string;
  label: string;
  percent: number;
  basis: number;
  pointsDelta: number;
  effectiveYmd: string;
  achievementYmd: string;
};

/** Ubah satu remisi manual. Potongan dihitung ulang dari poin pada saat baris itu, bukan dari poin hari ini. */
export async function updateManualRemisiById(input: {
  id: string;
  customLabel: string;
  customPercent: number;
  achievementYmd: string;
  note?: string;
}): Promise<{ ok: true; result: ManualRemisiEditResult } | { ok: false; error: string; status: number }> {
  const customLabel = input.customLabel.trim();
  if (customLabel.length < 2) {
    return { ok: false, error: "Nama jenis remisi/reward wajib diisi (minimal 2 karakter)", status: 400 };
  }
  const resolved = resolveManualRemisiPercent(input.customPercent);
  if (!resolved.ok) return { ok: false, error: resolved.error, status: 400 };
  const achievementYmd = input.achievementYmd.trim();
  if (!achievementYmd) {
    return { ok: false, error: "Tanggal prestasi wajib diisi", status: 400 };
  }
  if (achievementYmd > calendarTodayYmd()) {
    return { ok: false, error: "Tanggal prestasi tidak boleh di masa depan", status: 400 };
  }

  const row = await prisma.pointAdjustment.findUnique({
    where: { id: input.id },
    include: { student: { select: { id: true, name: true } } },
  });
  if (!row) return { ok: false, error: "Remisi tidak ditemukan", status: 404 };
  if (!isDeletableManualRemisi(row.reason, row.reversalOfId)) {
    return { ok: false, error: "Hanya remisi manual yang bisa diubah", status: 400 };
  }

  const scoped = await getGrossPointsOnOrBefore(row.studentId, achievementYmd);
  if (!scoped.ok) return { ok: false, error: scoped.error, status: 400 };
  if (scoped.eligibleGross < 1) {
    return {
      ok: false,
      error: `Tidak ada poin pelanggaran pada/sebelum ${achievementYmd}.`,
      status: 400,
    };
  }

  const basis = await balanceAtManualRemisi(row);
  const deduct = manualRemisiCutFromCurrentPoints(basis, resolved.percent);
  if (deduct < 1) {
    return {
      ok: false,
      error: "Pengurangan terlalu kecil (minimal 1 poin). Coba persen lebih besar.",
      status: 400,
    };
  }

  const reason = buildManualRemisiReason({
    note: input.note,
    customLabel,
    achievementYmd,
  });
  const at = adjustmentInstant(row);
  try {
    await prisma.pointAdjustment.update({
      where: { id: row.id },
      data: {
        pointsDelta: -deduct,
        reason,
        grossTotalBefore: basis,
        effectiveBefore: basis,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "Remisi tidak ditemukan", status: 404 };
    }
    if (isPointAdjustmentTableMissing(e)) {
      return { ok: false, error: "Tabel penyesuaian poin belum tersedia (jalankan migrasi DB)", status: 500 };
    }
    throw e;
  }

  return {
    ok: true,
    result: {
      id: row.id,
      studentId: row.studentId,
      studentName: row.student.name,
      label: customLabel,
      percent: resolved.percent,
      basis,
      pointsDelta: -deduct,
      effectiveYmd: dateInTimeZoneYmd(at),
      achievementYmd,
    },
  };
}

export async function getManualRemisiForEdit(id: string): Promise<
  | {
      ok: true;
      row: {
        id: string;
        studentName: string;
        className: string | null;
        label: string;
        percent: number | null;
        note: string;
        achievementYmd: string;
        effectiveYmd: string;
        basis: number;
        pointsDelta: number;
      };
    }
  | { ok: false; error: string; status: number }
> {
  const row = await prisma.pointAdjustment.findUnique({
    where: { id },
    include: { student: { select: { name: true, class: { select: { name: true } } } } },
  });
  if (!row) return { ok: false, error: "Remisi tidak ditemukan", status: 404 };
  if (!isDeletableManualRemisi(row.reason, row.reversalOfId)) {
    return { ok: false, error: "Hanya remisi manual yang bisa diubah", status: 400 };
  }
  const parsed = parseManualRemisiReason(row.reason);
  const at = adjustmentInstant(row);
  const basis = await balanceAtManualRemisi(row);
  const storedBasis = row.grossTotalBefore;
  const percent = storedBasis > 0 ? Math.round((Math.abs(row.pointsDelta) / storedBasis) * 100) : null;
  return {
    ok: true,
    row: {
      id: row.id,
      studentName: row.student.name,
      className: row.student.class?.name ?? null,
      label: parsed.customLabel?.trim() || "Remisi manual",
      percent: percent != null && percent >= 1 && percent <= 100 ? percent : null,
      note: parsed.note ?? "",
      achievementYmd: parsed.achievementYmd ?? dateInTimeZoneYmd(at),
      effectiveYmd: dateInTimeZoneYmd(at),
      basis,
      pointsDelta: row.pointsDelta,
    },
  };
}

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
