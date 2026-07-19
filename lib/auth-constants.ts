/** Pesan generik — hindari user enumeration (akun ada vs password salah). */
export const AUTH_GENERIC_CREDENTIALS_ERROR = "Email/NISN/NIP atau password salah.";

export const AUTH_ACCOUNT_UNAVAILABLE_ERROR =
  "Akun tidak dapat digunakan. Hubungi Administrator.";

export const AUTH_LOCKED_ERROR = "Terlalu banyak percobaan. Coba lagi nanti.";

export const AUTH_MAX_FAILED_LOGINS = 5;
export const AUTH_LOCK_DURATION_MS = 15 * 60 * 1000;

/** Batas gagal login per IP dalam jendela waktu (termasuk identifier yang tidak ketemu). */
export const AUTH_IP_MAX_FAILURES = 30;
export const AUTH_IP_WINDOW_MS = 15 * 60 * 1000;

export function isLoginLockoutEnabled(): boolean {
  return process.env.AUTH_LOGIN_LOCKOUT_ENABLED !== "false";
}
