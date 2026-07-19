import { prisma } from "@/lib/prisma";
import { ACTIVE_USER_WHERE } from "@/lib/user-status";

export const LAST_SA_ROLE_MSG = "Minimal harus ada 1 akun dengan role Super Admin.";
export const LAST_ACTIVE_SA_MSG =
  "Minimal harus ada 1 Super Admin yang aktif. Aktifkan atau tambahkan Super Admin lain dulu.";

/** Menurunkan role dari Super Admin — minimal total 2 baris SA sebelumnya. */
export async function assertCanDemoteSuperAdmin(userId: string): Promise<string | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, active: true },
  });
  if (me?.role !== "SUPER_ADMIN") return null;
  const total = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: { not: "LEFT" } } });
  if (total <= 1) return LAST_SA_ROLE_MSG;
  if (me.status === "ACTIVE" || me.active) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", ...ACTIVE_USER_WHERE, id: { not: userId } },
    });
    if (otherActive < 1) return LAST_ACTIVE_SA_MSG;
  }
  return null;
}

/** Soft-delete / hard-delete — tidak boleh menghilangkan satu-satunya Super Admin aktif. */
export async function assertCanDeleteSuperAdmin(userId: string): Promise<string | null> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true, active: true },
  });
  if (me?.role !== "SUPER_ADMIN") return null;
  const total = await prisma.user.count({ where: { role: "SUPER_ADMIN", status: { not: "LEFT" } } });
  if (total <= 1) return LAST_SA_ROLE_MSG;
  if (me.status === "ACTIVE" || me.active) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", ...ACTIVE_USER_WHERE, id: { not: userId } },
    });
    if (otherActive < 1) return LAST_ACTIVE_SA_MSG;
  }
  return null;
}
