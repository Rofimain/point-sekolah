import { prisma } from "@/lib/prisma";
import { assertCanDeleteSuperAdmin } from "@/lib/super-admin-policy";

/** Filter default: baris yang belum di-soft-delete. */
export const NOT_DELETED = { deletedAt: null } as const;

/**
 * Soft-delete user: set deletedAt, bebaskan unique email/nisn/nip,
 * invalidate session (authVersion++), nonaktifkan login.
 */
export async function softDeleteUser(opts: { userId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.user.findFirst({
    where: { id: opts.userId, deletedAt: null },
    select: { id: true, role: true, email: true, nisn: true, nip: true },
  });
  if (!existing) return { ok: false, error: "Tidak ditemukan" };

  const saErr = await assertCanDeleteSuperAdmin(existing.id);
  if (saErr) return { ok: false, error: saErr };

  const stamp = Date.now().toString(36);
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      deletedAt: new Date(),
      active: false,
      status: "LEFT",
      authVersion: { increment: 1 },
      // Bebaskan unique agar email/NISN/NIP bisa dipakai lagi
      email: `deleted.${stamp}.${existing.id}.${existing.email}`.slice(0, 190),
      nisn: existing.nisn ? `del_${stamp}_${existing.nisn}`.slice(0, 64) : null,
      nip: existing.nip ? `del_${stamp}_${existing.nip}`.slice(0, 64) : null,
      googleSub: null,
      parentTelegramLinkToken: null,
    },
  });
  return { ok: true };
}

/** Soft-delete banyak user (caller wajib filter otorisasi). */
export async function softDeleteUsersByIds(opts: { ids: string[] }): Promise<number> {
  const unique = [...new Set(opts.ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;

  let count = 0;
  for (const id of unique) {
    const saErr = await assertCanDeleteSuperAdmin(id);
    if (saErr) throw new Error(saErr);
    const result = await softDeleteUser({ userId: id });
    if (result.ok) count += 1;
  }
  return count;
}

export async function softDeleteStudentsByClassId(opts: { classId: string }): Promise<number> {
  const targets = await prisma.user.findMany({
    where: { role: "STUDENT", classId: opts.classId, deletedAt: null },
    select: { id: true },
  });
  if (targets.length === 0) return 0;
  return softDeleteUsersByIds({ ids: targets.map((t) => t.id) });
}

export async function softDeleteViolationRecord(recordId: string): Promise<boolean> {
  const existing = await prisma.violationRecord.findFirst({
    where: { id: recordId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.violationRecord.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
  return true;
}
