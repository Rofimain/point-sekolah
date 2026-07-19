import { prisma } from "@/lib/prisma";
import { DEFAULT_VIOLATION_BAGIAN, type ViolationBagianRow } from "@/lib/violation-sections";

/** Baca master bagian; fallback ke default jika tabel belum ada / kosong. */
export async function listViolationBagian(opts?: { includeInactive?: boolean }): Promise<ViolationBagianRow[]> {
  try {
    const rows = await prisma.violationBagian.findMany({
      where: opts?.includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, sortOrder: true, active: true },
    });
    if (rows.length > 0) return rows;
  } catch {
    // tabel belum dimigrate
  }
  return DEFAULT_VIOLATION_BAGIAN.map((b) => ({ ...b, active: true }));
}
