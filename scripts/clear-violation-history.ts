/**
 * Hapus seluruh riwayat pelanggaran siswa + bukti foto + remisi/penyesuaian poin.
 * Master jenis pelanggaran, user, kelas, dan template cetak TIDAK dihapus.
 *
 * Usage:
 *   CONFIRM_CLEAR_VIOLATION_HISTORY=YES npx tsx scripts/clear-violation-history.ts
 */
import { createPrismaClient } from "../lib/prisma";

const prisma = createPrismaClient();

async function main() {
  if (process.env.CONFIRM_CLEAR_VIOLATION_HISTORY !== "YES") {
    console.error(
      "Dibatalkan. Set CONFIRM_CLEAR_VIOLATION_HISTORY=YES untuk menghapus semua catatan pelanggaran & remisi."
    );
    process.exit(1);
  }

  const [evidence, records, adjustments] = await Promise.all([
    prisma.violationEvidenceImage.count(),
    prisma.violationRecord.count(),
    prisma.pointAdjustment.count(),
  ]);

  console.log(
    `[clear-violation-history] Akan dihapus: ${records} catatan, ${evidence} foto bukti, ${adjustments} remisi/penyesuaian`
  );

  const deletedEvidence = await prisma.violationEvidenceImage.deleteMany();
  const deletedRecords = await prisma.violationRecord.deleteMany();
  const deletedAdjustments = await prisma.pointAdjustment.deleteMany();

  console.log(
    `[clear-violation-history] Selesai. Hapus: records=${deletedRecords.count}, evidence=${deletedEvidence.count}, adjustments=${deletedAdjustments.count}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
