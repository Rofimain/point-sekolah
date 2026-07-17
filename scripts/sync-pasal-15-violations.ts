/**
 * Sync master jenis pelanggaran Pasal 15 ke DB yang sudah berisi data.
 * Aman untuk production: tidak membuat user/demo; hanya upsert ViolationType.
 */
import { createPrismaClient } from "../lib/prisma";
import { PASAL_15_VIOLATIONS, pasal15ToCreateInput } from "../prisma/pasal-15-violations";

const OLD_DEMO_IDS = ["vt-001", "vt-002", "vt-003", "vt-004", "vt-005", "vt-006", "vt-007"];

const prisma = createPrismaClient();

async function main() {
  console.log(`[sync-pasal-15] Upsert ${PASAL_15_VIOLATIONS.length} jenis pelanggaran…`);

  for (const v of PASAL_15_VIOLATIONS) {
    const data = pasal15ToCreateInput(v);
    await prisma.violationType.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        section: data.section,
        category: data.category,
        points: data.points,
        description: data.description,
        sortOrder: data.sortOrder,
        active: true,
      },
      create: data,
    });
  }

  const deactivated = await prisma.violationType.updateMany({
    where: { id: { in: OLD_DEMO_IDS } },
    data: { active: false },
  });

  const bySection = await prisma.violationType.groupBy({
    by: ["section"],
    where: { active: true },
    _count: { _all: true },
  });

  console.log(`[sync-pasal-15] Demo lama dinonaktifkan: ${deactivated.count}`);
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
