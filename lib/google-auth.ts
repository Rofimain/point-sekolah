import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canUserLogin } from "@/lib/user-status";
import { recordUserLifecycleEvent } from "@/lib/user-lifecycle-audit";
import { registerSuccessfulLogin } from "@/lib/auth-login-guard";
import { recordAuthLoginEvent } from "@/lib/auth-audit";
import { getAuthRequestMeta } from "@/lib/auth-request-meta";
import { APP_ROLES } from "@/lib/staff-roles";
import { isGoogleEmailDomainAllowed } from "@/lib/google-auth-messages";

export { inferGooglePortal, isGoogleEmailDomainAllowed } from "@/lib/google-auth-messages";

export function isGoogleAuthEnabled(): boolean {
  if (process.env.AUTH_GOOGLE_ENABLED === "false") return false;
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/** Role yang boleh Google login. Kosong / unset = semua role aplikasi. */
export function googleAllowedRoles(): Set<string> {
  const raw = process.env.AUTH_GOOGLE_ALLOWED_ROLES?.trim();
  if (!raw) return new Set(APP_ROLES);
  const roles = raw
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r) => (APP_ROLES as readonly string[]).includes(r));
  return new Set(roles.length > 0 ? roles : APP_ROLES);
}

export function isGoogleRoleAllowed(role: string): boolean {
  return googleAllowedRoles().has(role);
}

export type GoogleResolveOk = {
  ok: true;
  user: User & { class: { name: string } | null };
};

export type GoogleResolveErr = {
  ok: false;
  code:
    | "NOT_REGISTERED"
    | "UNAVAILABLE"
    | "ROLE_BLOCKED"
    | "CONFLICT"
    | "DISABLED"
    | "EMAIL_UNVERIFIED"
    | "DOMAIN_NOT_ALLOWED";
};

export type GoogleResolveResult = GoogleResolveOk | GoogleResolveErr;

/**
 * Cari user: googleSub dulu, lalu email untuk initial link.
 * Tidak membuat user baru. Role tetap dari DB.
 */
export async function resolveAndLinkGoogleUser(input: {
  googleSub: string;
  email: string | null | undefined;
  emailVerified?: boolean | null;
}): Promise<GoogleResolveResult> {
  if (!isGoogleAuthEnabled()) return { ok: false, code: "DISABLED" };

  const googleSub = input.googleSub.trim();
  if (!googleSub) return { ok: false, code: "NOT_REGISTERED" };
  if (input.emailVerified === false) return { ok: false, code: "EMAIL_UNVERIFIED" };

  const email = input.email?.trim().toLowerCase() || "";

  const bySub = await prisma.user.findUnique({
    where: { googleSub },
    include: { class: true },
  });

  if (bySub) {
    if (!canUserLogin(bySub.status)) return { ok: false, code: "UNAVAILABLE" };
    if (!isGoogleRoleAllowed(bySub.role)) return { ok: false, code: "ROLE_BLOCKED" };
    if (email && !isGoogleEmailDomainAllowed(email)) {
      return { ok: false, code: "DOMAIN_NOT_ALLOWED" };
    }
    await markGoogleLoginSuccess(bySub.id, "OK");
    return { ok: true, user: bySub };
  }

  if (!email) return { ok: false, code: "NOT_REGISTERED" };

  if (!isGoogleEmailDomainAllowed(email)) {
    return { ok: false, code: "DOMAIN_NOT_ALLOWED" };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email },
    include: { class: true },
  });

  if (!byEmail) return { ok: false, code: "NOT_REGISTERED" };

  if (byEmail.googleSub && byEmail.googleSub !== googleSub) {
    return { ok: false, code: "CONFLICT" };
  }

  if (!canUserLogin(byEmail.status)) return { ok: false, code: "UNAVAILABLE" };
  if (!isGoogleRoleAllowed(byEmail.role)) return { ok: false, code: "ROLE_BLOCKED" };

  const alreadyLinked = Boolean(byEmail.googleSub);
  const updated = await prisma.user.update({
    where: { id: byEmail.id },
    data: {
      googleSub,
      authProvider: byEmail.authProvider === "GOOGLE" ? "GOOGLE" : "BOTH",
      emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
    },
    include: { class: true },
  });

  if (!alreadyLinked) {
    await recordUserLifecycleEvent({
      userId: updated.id,
      event: "GOOGLE_ACCOUNT_LINKED",
      reason: "initial_oauth_link",
      meta: { googleSub, email },
    });
  }

  await markGoogleLoginSuccess(updated.id, alreadyLinked ? "OK" : "OK_LINKED");
  return { ok: true, user: updated };
}

async function markGoogleLoginSuccess(userId: string, reason: string) {
  await registerSuccessfulLogin(userId);
  const meta = await getAuthRequestMeta();
  await recordAuthLoginEvent({
    userId,
    provider: "google",
    success: true,
    reason,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export function googleErrorRedirect(code: GoogleResolveErr["code"], portal: "student" | "staff"): string {
  const base = portal === "staff" ? "/admin/login" : "/login";
  return `${base}?error=${encodeURIComponent(code)}`;
}
