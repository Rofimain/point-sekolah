/**
 * Super Admin — akses tertinggi (pengaturan sistem, manajemen user, dll.).
 * Admin — guru, piket, dan wali kelas: hak akses operasional sama di bawah Super Admin.
 */
export const SUPER_ADMIN_ROLE = "SUPER_ADMIN" as const;

/** Guru, piket, wali kelas: satu tingkat "Admin" di bawah Super Admin. */
export const ADMIN_ROLES = ["TEACHER", "PIKET", "WALI_KELAS"] as const;

/** Semua peran yang boleh akses area admin/guru (bukan siswa). */
export const STAFF_ROLES = [...ADMIN_ROLES, SUPER_ADMIN_ROLE] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isStaffRole(role: string | undefined | null): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}

export function isSuperAdmin(role: string | undefined | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}

/** Guru / piket / wali kelas (bukan Super Admin). */
export function isAdminRole(role: string | undefined | null): boolean {
  return role != null && (ADMIN_ROLES as readonly string[]).includes(role);
}
