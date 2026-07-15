export const MIN_PASSWORD_CHARS = 12;
export const MAX_PASSWORD_BYTES = 72;

export function validateNewPassword(password: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof password !== "string") return { ok: false, error: "Password baru wajib diisi." };
  if (password.length < MIN_PASSWORD_CHARS) {
    return { ok: false, error: `Password baru minimal ${MIN_PASSWORD_CHARS} karakter.` };
  }
  if (new TextEncoder().encode(password).byteLength > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `Password baru maksimal ${MAX_PASSWORD_BYTES} byte UTF-8.` };
  }
  return { ok: true, value: password };
}
