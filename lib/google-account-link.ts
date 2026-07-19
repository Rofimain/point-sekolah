import { prisma } from "@/lib/prisma";
import { recordUserLifecycleEvent, type LifecycleActor } from "@/lib/user-lifecycle-audit";
import { isGoogleEmailDomainAllowed } from "@/lib/google-auth-messages";

/** Putus tautan Google. Login berikutnya dengan Google = initial link ulang via email. */
export async function unlinkGoogleAccount(opts: {
  userId: string;
  actor?: LifecycleActor | null;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, googleSub: true, authProvider: true, email: true },
  });
  if (!existing) return { ok: false, error: "Tidak ditemukan" };
  if (!existing.googleSub) return { ok: false, error: "Akun Google belum terhubung." };

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      googleSub: null,
      authProvider: "CREDENTIALS",
      authVersion: { increment: 1 },
    },
  });

  await recordUserLifecycleEvent({
    userId: existing.id,
    event: "GOOGLE_ACCOUNT_UNLINKED",
    reason: opts.reason ?? "admin_unlink",
    actor: opts.actor,
    meta: { previousGoogleSub: existing.googleSub, email: existing.email },
  });

  return { ok: true };
}

export type GoogleReadinessRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  googleLinked: boolean;
  emailDomainOk: boolean;
  readyForGoogleLogin: boolean;
};

/** Audit kesiapan Google — tidak mengubah data. */
export async function auditGoogleReadiness(opts?: { take?: number; role?: string }): Promise<{
  summary: {
    total: number;
    linked: number;
    domainOkUnlinked: number;
    domainBad: number;
    inactiveBlocked: number;
  };
  samples: {
    readyUnlinked: GoogleReadinessRow[];
    domainMismatch: GoogleReadinessRow[];
  };
}> {
  const take = Math.min(opts?.take ?? 50, 200);
  const users = await prisma.user.findMany({
    where: {
      status: { not: "LEFT" },
      ...(opts?.role ? { role: opts.role as never } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      googleSub: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const rows: GoogleReadinessRow[] = users.map((u) => {
    const domainOk = isGoogleEmailDomainAllowed(u.email);
    const googleLinked = Boolean(u.googleSub);
    const readyForGoogleLogin = u.status === "ACTIVE" && domainOk;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      googleLinked,
      emailDomainOk: domainOk,
      readyForGoogleLogin,
    };
  });

  const linked = rows.filter((r) => r.googleLinked).length;
  const domainOkUnlinked = rows.filter((r) => r.emailDomainOk && !r.googleLinked && r.status === "ACTIVE").length;
  const domainBad = rows.filter((r) => !r.emailDomainOk).length;
  const inactiveBlocked = rows.filter((r) => r.status !== "ACTIVE").length;

  return {
    summary: {
      total: rows.length,
      linked,
      domainOkUnlinked,
      domainBad,
      inactiveBlocked,
    },
    samples: {
      readyUnlinked: rows.filter((r) => r.readyForGoogleLogin && !r.googleLinked).slice(0, take),
      domainMismatch: rows.filter((r) => !r.emailDomainOk).slice(0, take),
    },
  };
}
