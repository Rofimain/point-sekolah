import { prisma } from "@/lib/prisma";
import {
  AUTH_IP_MAX_FAILURES,
  AUTH_IP_WINDOW_MS,
  isLoginLockoutEnabled,
  shouldEnforceSingleSession,
} from "@/lib/auth-constants";
import { computeLockUntil, isAccountLocked } from "@/lib/auth-lockout";

export { computeLockUntil, isAccountLocked } from "@/lib/auth-lockout";
export { shouldEnforceSingleSession } from "@/lib/auth-constants";

/** Setelah gagal login pada user yang diketahui. */
export async function registerFailedLogin(userId: string): Promise<{ locked: boolean }> {
  if (!isLoginLockoutEnabled()) return { locked: false };

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginCount: true, lockedUntil: true },
  });
  if (!user) return { locked: false };

  if (isAccountLocked(user.lockedUntil, now)) {
    return { locked: true };
  }

  /** Setelah masa kunci berakhir, mulai hitung gagal dari nol. */
  const lockExpired = Boolean(user.lockedUntil && user.lockedUntil.getTime() <= now.getTime());
  const nextCount = (lockExpired ? 0 : user.failedLoginCount) + 1;
  const lockedUntil = computeLockUntil(nextCount, now);
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: nextCount,
      lockedUntil,
    },
  });
  return { locked: Boolean(lockedUntil) };
}

/**
 * Setelah login sukses.
 * Role STUDENT: bump `authVersion` agar sesi JWT lama (perangkat lain) langsung invalid.
 * Staff: multi-sesi tetap diizinkan.
 */
export async function registerSuccessfulLogin(
  userId: string,
  opts?: { role?: string | null }
): Promise<{ authVersion: number }> {
  let role = opts?.role ?? null;
  if (role == null) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    role = row?.role ?? null;
  }

  const rotateSession = shouldEnforceSingleSession(role);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      ...(rotateSession ? { authVersion: { increment: 1 } } : {}),
    },
    select: { authVersion: true },
  });
  return { authVersion: updated.authVersion };
}

/** Admin reset password / unlock eksplisit. */
export async function clearLoginLockout(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
}

/** Rate limit per IP berdasarkan audit gagal (anti stuffing saat identifier tidak ketemu). */
export async function isIpLoginRateLimited(ip: string | null | undefined, now = new Date()): Promise<boolean> {
  if (!isLoginLockoutEnabled() || !ip) return false;
  const since = new Date(now.getTime() - AUTH_IP_WINDOW_MS);
  const failures = await prisma.authLoginEvent.count({
    where: {
      ip,
      success: false,
      createdAt: { gte: since },
    },
  });
  return failures >= AUTH_IP_MAX_FAILURES;
}
