import { prisma } from "@/lib/prisma";
import { portalFromAuthProvider, recordAccessLog } from "@/lib/access-log";
import { classifyLoginIdentifier, loginMethodLabel } from "@/lib/access-log-diff";

export type AuthAuditInput = {
  userId?: string | null;
  identifier?: string | null;
  provider: string;
  success: boolean;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Untuk Google: portal siswa vs staf. */
  googlePortal?: "student" | "staff" | null;
  actorName?: string | null;
  actorRole?: string | null;
};

/** Tulis audit login; gagal tulis tidak boleh menggagalkan login. */
export async function recordAuthLoginEvent(input: AuthAuditInput): Promise<void> {
  try {
    await prisma.authLoginEvent.create({
      data: {
        userId: input.userId ?? undefined,
        identifier: input.identifier ? input.identifier.slice(0, 191) : undefined,
        provider: input.provider,
        success: input.success,
        reason: input.reason ?? undefined,
        ip: input.ip ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[auth-audit] gagal menulis AuthLoginEvent", err);
  }

  const portal = portalFromAuthProvider(input.provider, input.googlePortal);
  const kind = classifyLoginIdentifier(input.identifier, input.provider);
  const method = loginMethodLabel(input.provider, kind);
  const idLabel = input.identifier?.trim() || "tanpa identifier";
  const summary = input.success
    ? `Login berhasil (${method}): ${idLabel}`
    : `Login gagal (${method}): ${idLabel}${input.reason ? ` — ${input.reason}` : ""}`;

  await recordAccessLog({
    portal,
    category: "LOGIN",
    action: input.success ? "LOGIN_OK" : "LOGIN_FAIL",
    success: input.success,
    actor: input.userId
      ? {
          id: input.userId,
          name: input.actorName ?? null,
          role: input.actorRole ?? null,
        }
      : null,
    targetType: "User",
    targetId: input.userId ?? null,
    summary,
    meta: {
      provider: input.provider,
      method,
      identifierKind: kind,
      reason: input.reason ?? null,
      identifier: input.identifier ?? null,
      authType: input.provider === "google" ? "oauth" : "credentials",
    },
    ip: input.ip,
    userAgent: input.userAgent,
  });
}
