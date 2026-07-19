import { AUTH_LOCK_DURATION_MS, AUTH_MAX_FAILED_LOGINS, isLoginLockoutEnabled } from "@/lib/auth-constants";

export function isAccountLocked(lockedUntil: Date | null | undefined, now = new Date()): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

export function computeLockUntil(failedLoginCount: number, now = new Date()): Date | null {
  if (!isLoginLockoutEnabled()) return null;
  if (failedLoginCount < AUTH_MAX_FAILED_LOGINS) return null;
  return new Date(now.getTime() + AUTH_LOCK_DURATION_MS);
}
