/** Email selalu disimpan & dicari dalam bentuk lowercase (login credentials). */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
