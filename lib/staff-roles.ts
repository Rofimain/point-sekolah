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
 * Akses halaman/API manajemen pengguna.
 * TEACHER tidak mengelola user (tidak boleh membuat/hapus/ubah role siapa pun).
 */
export function canManageUsers(role: string | undefined | null): boolean {
  return isAdminRole(role) || isSuperAdmin(role);
}

/** Semua staf boleh menambah catatan pelanggaran. */
export function canCreateViolationRecord(role: string | undefined | null): boolean {
  return isStaffRole(role);
}

/**
 * Boleh membuat user dengan role target?
 * - SUPER_ADMIN: semua role
 * - ADMIN: STUDENT, TEACHER, ADMIN (bukan SUPER_ADMIN)
 * - TEACHER: tidak boleh membuat user apa pun
 */
export function canCreateUserWithRole(
  actorRole: string | undefined | null,
  newRole: string | undefined | null
): boolean {
  if (!actorRole || !newRole || !(newRole in ROLE_RANK)) return false;
  if (isSuperAdmin(actorRole)) return true;
  if (isAdminRole(actorRole)) {
    return newRole === "STUDENT" || newRole === "TEACHER" || newRole === "ADMIN";
  }
  return false;
}

/**
 * Ubah akun target (termasuk nonaktifkan / ubah field):
 * - SUPER_ADMIN: bebas
 * - ADMIN: hanya TEACHER dan STUDENT (bukan peer ADMIN / SUPER_ADMIN)
 * - TEACHER: tidak boleh
 */
export function canModifyUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  if (isSuperAdmin(actorRole)) return true;
  if (isAdminRole(actorRole)) {
    return targetRole === "TEACHER" || targetRole === "STUDENT";
  }
  return false;
}

/**
 * Hapus akun target — sama batasan dengan canModifyUser.
 */
export function canDeleteUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  return canModifyUser(actorRole, targetRole);
}

/** Label tampilan role (bukan jabatan). */
export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    STUDENT: "Siswa",
    TEACHER: "Guru",
    ADMIN: "Admin",
    SUPER_ADMIN: "Super Admin",
  };
  return map[role] || role;
}

/** Nama staf + jabatan opsional untuk kolom "dicatat oleh". */
export function formatStaffDisplayName(user: {
  name?: string | null;
  jabatan?: string | null;
}): string {
  const name = user.name?.trim() || "Staf";
  const jabatan = user.jabatan?.trim();
  return jabatan ? `${name} (${jabatan})` : name;
}
