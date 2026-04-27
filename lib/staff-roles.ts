/** Peran yang boleh akses area admin/guru (bukan siswa). */
export const STAFF_ROLES = ["TEACHER", "PIKET", "WALI_KELAS", "SUPER_ADMIN"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string | undefined | null): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role);
}
