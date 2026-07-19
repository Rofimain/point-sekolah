import { prisma } from "@/lib/prisma";
import { assertCanDeleteSuperAdmin } from "@/lib/super-admin-policy";

/**
 * Hapus permanen user + data terkait (catatan pelanggaran, bukti, remisi, audit lifecycle).
 * Auth login events: userId di-null-kan (onDelete SetNull).
 */
export async function hardDeleteUser(opts: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, role: true },
  });
  if (!existing) return { ok: false, error: "Tidak ditemukan" };

  const saErr = await assertCanDeleteSuperAdmin(existing.id);
  if (saErr) return { ok: false, error: saErr };

  await prisma.user.delete({ where: { id: existing.id } });
  return { ok: true };
}

/** Hapus permanen banyak user (tanpa cek role — caller wajib filter). */
export async function hardDeleteUsersByIds(opts: { ids: string[] }): Promise<number> {
  const unique = [...new Set(opts.ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;

  for (const id of unique) {
    const saErr = await assertCanDeleteSuperAdmin(id);
    if (saErr) throw new Error(saErr);
  }

  const result = await prisma.user.deleteMany({
    where: { id: { in: unique } },
  });
  return result.count;
}

export async function hardDeleteStudentsByClassId(opts: { classId: string }): Promise<number> {
  const targets = await prisma.user.findMany({
    where: { role: "STUDENT", classId: opts.classId },
    select: { id: true },
  });
  if (targets.length === 0) return 0;
  return hardDeleteUsersByIds({ ids: targets.map((t) => t.id) });
}
