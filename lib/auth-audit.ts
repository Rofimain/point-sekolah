import { prisma } from "@/lib/prisma";

export type AuthAuditInput = {
  userId?: string | null;
  identifier?: string | null;
  provider: string;
  success: boolean;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
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
}
