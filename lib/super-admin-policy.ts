import { prisma } from "@/lib/prisma";

export const LAST_SA_ROLE_MSG = "Minimal harus ada 1 akun dengan role Super Admin.";
export const LAST_ACTIVE_SA_MSG =
  "Minimal harus ada 1 Super Admin yang aktif. Aktifkan atau tambahkan Super Admin lain dulu.";

/** Menurunkan role dari Super Admin — minimal total 2 baris SA sebelumnya. */
export async function assertCanDemoteSuperAdmin(userId: string): Promise<string | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (me?.role !== "SUPER_ADMIN") return null;
  const total = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  if (total <= 1) return LAST_SA_ROLE_MSG;
  if (me.active) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", active: true, id: { not: userId } },
    });
    if (otherActive < 1) return LAST_ACTIVE_SA_MSG;
  }
  return null;
}

/** Menghapus baris user — tidak boleh menghapus satu-satunya Super Admin (by role). */
export async function assertCanDeleteSuperAdmin(userId: string): Promise<string | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (me?.role !== "SUPER_ADMIN") return null;
  const total = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  if (total <= 1) return LAST_SA_ROLE_MSG;
  if (me.active) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", active: true, id: { not: userId } },
    });
    if (otherActive < 1) return LAST_ACTIVE_SA_MSG;
  }
  return null;
}
