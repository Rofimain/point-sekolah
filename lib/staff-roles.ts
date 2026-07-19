export const APP_ROLES = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
export const STAFF_ROLES = ["TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Semakin tinggi = semakin berwenang. Dipakai untuk batasan ubah/hapus antar staf. */
export const ROLE_RANK: Record<string, number> = {
  STUDENT: 0,
  TEACHER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function roleRank(role: string | undefined | null): number {
  if (!role) return -1;
  return ROLE_RANK[role] ?? -1;
}

export function isStaffRole(role: string | undefined | null): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === "SUPER_ADMIN";
}

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "ADMIN";
}

/** Admin dan Super Admin boleh mengubah data master serta catatan yang sudah ada. */
export function canManageData(role: string | undefined | null): boolean {
  return isAdminRole(role) || isSuperAdmin(role);
}

/**
 * Staf (Guru/Admin/Super Admin) boleh mengakses manajemen pengguna.
 * Batasan ubah/hapus pakai canModifyUser / canDeleteUser.
 */
export function canManageUsers(role: string | undefined | null): boolean {
  return isStaffRole(role);
}

/** Semua staf boleh menambah catatan pelanggaran. */
export function canCreateViolationRecord(role: string | undefined | null): boolean {
  return isStaffRole(role);
}

/**
 * Boleh membuat user dengan role target?
 * - SUPER_ADMIN: semua role
 * - Staf lain: role dengan rank ≤ dirinya, kecuali SUPER_ADMIN (hanya sesama SA)
 *   → Guru boleh tambah Guru/Siswa; Admin boleh tambah Admin/Guru/Siswa
 */
export function canCreateUserWithRole(
  actorRole: string | undefined | null,
  newRole: string | undefined | null
): boolean {
  if (!actorRole || !newRole || !(newRole in ROLE_RANK)) return false;
  if (isSuperAdmin(actorRole)) return true;
  if (!isStaffRole(actorRole)) return false;
  if (newRole === "SUPER_ADMIN") return false;
  return roleRank(newRole) <= roleRank(actorRole);
}

/**
 * Ubah akun target: SUPER_ADMIN bebas; selain itu actor harus rank > target
 * (tidak boleh ubah peer atau atasan).
 */
export function canModifyUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  if (isSuperAdmin(actorRole)) return true;
  if (!isStaffRole(actorRole)) return false;
  return roleRank(actorRole) > roleRank(targetRole);
}

/**
 * Hapus akun target: sama aturan dengan canModifyUser
 * (guru tidak boleh hapus guru lain; hanya SUPER_ADMIN yang boleh hapus SUPER_ADMIN).
 */
export function canDeleteUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  return canModifyUser(actorRole, targetRole);
}
