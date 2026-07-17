/**
 * Sync master jenis pelanggaran ke DB yang sudah berisi data.
 * Aman untuk production: upsert ViolationType + hapus jenis nonaktif yang tidak dipakai riwayat.
 */
import { createPrismaClient } from "../lib/prisma";
import { PASAL_15_VIOLATIONS, pasal15ToCreateInput } from "../prisma/pasal-15-violations";
import { violationNameSortOrder } from "../lib/violation-name";

const OLD_DEMO_IDS = ["vt-001", "vt-002", "vt-003", "vt-004", "vt-005", "vt-006", "vt-007"];

const prisma = createPrismaClient();

async function main() {
  console.log(`[sync-pasal-15] Upsert ${PASAL_15_VIOLATIONS.length} jenis pelanggaran…`);

  for (const v of PASAL_15_VIOLATIONS) {
    const data = pasal15ToCreateInput(v);
    const sortOrder = violationNameSortOrder(data.name) || data.sortOrder;
    await prisma.violationType.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        section: data.section,
        category: data.category,
        points: data.points,
        description: data.description,
        sortOrder,
        active: true,
      },
      create: { ...data, sortOrder },
    });
  }

  // Hapus demo lama jika tidak dipakai catatan
  let demoDeleted = 0;
  for (const id of OLD_DEMO_IDS) {
    const usage = await prisma.violationRecord.count({ where: { violationTypeId: id } });
    if (usage > 0) {
      await prisma.violationType.updateMany({ where: { id }, data: { active: false } });
      continue;
    }
    const r = await prisma.violationType.deleteMany({ where: { id } });
    demoDeleted += r.count;
  }

  // Bersihkan semua jenis nonaktif tanpa riwayat (termasuk "tes" dll.)
  const inactive = await prisma.violationType.findMany({
    where: { active: false },
    select: { id: true, name: true, _count: { select: { records: true } } },
  });
  let purged = 0;
  for (const row of inactive) {
    if (row._count.records > 0) continue;
    await prisma.violationType.delete({ where: { id: row.id } });
    purged += 1;
    console.log(`  hapus nonaktif: ${row.name}`);
  }

  // Rapikan sortOrder semua yang aktif menurut nomor di nama
  const active = await prisma.violationType.findMany({ where: { active: true }, select: { id: true, name: true } });
  for (const row of active) {
    const sortOrder = violationNameSortOrder(row.name);
    if (sortOrder > 0) {
      await prisma.violationType.update({ where: { id: row.id }, data: { sortOrder } });
    }
  }

  const bySection = await prisma.violationType.groupBy({
    by: ["section"],
    where: { active: true },
    _count: { _all: true },
  });

  console.log(`[sync-pasal-15] Demo lama dihapus: ${demoDeleted}`);
  console.log(`[sync-pasal-15] Nonaktif dibersihkan: ${purged}`);
  console.log("[sync-pasal-15] Aktif per bagian:");
  for (const row of bySection) {
    console.log(`  ${row.section ?? "(tanpa bagian)"}: ${row._count._all}`);
  }
  console.log("[sync-pasal-15] Selesai.");
}

main()
  .catch((err) => {
    console.error("[sync-pasal-15] Gagal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
