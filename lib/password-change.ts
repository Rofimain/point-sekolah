/** true jika akun masih memakai password yang diset admin/default (belum diganti sendiri). */
export function requiresPasswordChange(passwordChangedAt: Date | null | undefined): boolean {
  return passwordChangedAt == null;
}
