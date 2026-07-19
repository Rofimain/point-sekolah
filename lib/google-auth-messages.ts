import { AUTH_SESSION_REPLACED_ERROR } from "@/lib/auth-constants";

export const GOOGLE_NOT_REGISTERED_MESSAGE = "Akun Anda belum terdaftar. Silakan hubungi Administrator.";
export const GOOGLE_UNAVAILABLE_MESSAGE = "Akun tidak dapat digunakan. Hubungi Administrator.";
export const GOOGLE_ROLE_BLOCKED_MESSAGE = "Login Google tidak diizinkan untuk peran akun Anda.";
export const GOOGLE_DISABLED_MESSAGE = "Login Google belum diaktifkan.";
export const GOOGLE_CONFLICT_MESSAGE = "Akun Google tidak cocok dengan data pengguna. Hubungi Administrator.";
export const GOOGLE_DOMAIN_MESSAGE = "Gunakan akun Google dengan email domain sekolah yang sudah dikonfigurasi.";

const SESSION_ENDED_MESSAGE = "Sesi berakhir. Silakan login lagi.";

export function mapGoogleErrorCode(code: string | null | undefined): string | null {
  switch (code) {
    case "NOT_REGISTERED":
    case "AccessDenied":
    case "OAuthAccountNotLinked":
    case "EMAIL_UNVERIFIED":
      return GOOGLE_NOT_REGISTERED_MESSAGE;
    case "UNAVAILABLE":
      return GOOGLE_UNAVAILABLE_MESSAGE;
    case "ROLE_BLOCKED":
      return GOOGLE_ROLE_BLOCKED_MESSAGE;
    case "DISABLED":
    case "Configuration":
      return GOOGLE_DISABLED_MESSAGE;
    case "CONFLICT":
      return GOOGLE_CONFLICT_MESSAGE;
    case "DOMAIN_NOT_ALLOWED":
      return GOOGLE_DOMAIN_MESSAGE;
    case "SESSION_REPLACED":
      return AUTH_SESSION_REPLACED_ERROR;
    case "SessionRevoked":
    case "SESSION_ENDED":
      return SESSION_ENDED_MESSAGE;
    default:
      return null;
  }
}

export function inferGooglePortal(callbackUrl: string | null | undefined): "student" | "staff" {
  if (!callbackUrl) return "student";
  try {
    const path = callbackUrl.startsWith("http")
      ? new URL(callbackUrl).pathname + new URL(callbackUrl).search
      : callbackUrl;
    if (path.startsWith("/admin") || path.startsWith("/dashboard") || path.includes("portal=staff")) {
      return "staff";
    }
  } catch {
    /* ignore */
  }
  return "student";
}

/**
 * Domain email yang diizinkan untuk Google login.
 * Default: NEXT_PUBLIC_STAFF_DOMAIN + NEXT_PUBLIC_STUDENT_DOMAIN.
 * Override: AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS="domain1.sch.id,domain2.sch.id"
 */
export function googleAllowedEmailDomains(): Set<string> {
  const raw = process.env.AUTH_GOOGLE_ALLOWED_EMAIL_DOMAINS?.trim();
  const list = raw ? raw.split(",") : [process.env.NEXT_PUBLIC_STAFF_DOMAIN, process.env.NEXT_PUBLIC_STUDENT_DOMAIN];
  return new Set(list.map((d) => d?.trim().toLowerCase().replace(/^@/, "")).filter((d): d is string => Boolean(d)));
}

export function isGoogleEmailDomainAllowed(email: string): boolean {
  const domains = googleAllowedEmailDomains();
  if (domains.size === 0) return true;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return domains.has(email.slice(at + 1).toLowerCase());
}
