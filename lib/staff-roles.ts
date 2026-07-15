export const APP_ROLES = ["STUDENT", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
export const STAFF_ROLES = ["TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

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

/** Semua staf boleh menambah catatan pelanggaran; guru tidak boleh mutasi data lain. */
export function canCreateViolationRecord(role: string | undefined | null): boolean {
  return isStaffRole(role);
}

/** Admin hanya boleh mengubah akun Guru dan Siswa. */
export function canModifyUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  if (isSuperAdmin(actorRole)) return true;
  return isAdminRole(actorRole) && targetRole !== "ADMIN" && targetRole !== "SUPER_ADMIN";
}

/** Admin tidak boleh menghapus sesama Admin atau Super Admin. */
export function canDeleteUser(
  actorRole: string | undefined | null,
  targetRole: string | undefined | null
): boolean {
  return canModifyUser(actorRole, targetRole);
}
