import { prisma } from "@/lib/prisma";
import type { Prisma, UserStatus } from "@/generated/prisma/client";
import { ACTIVE_USER_WHERE, softDeleteStatus, lifecycleFieldsForStatus } from "@/lib/user-status";
import { recordUserLifecycleEvent, type LifecycleActor } from "@/lib/user-lifecycle-audit";

/** Soft-delete satu user: status LEFT, bump authVersion, audit. Tidak hard-delete. */
export async function softDeleteUser(opts: {
  userId: string;
  actor?: LifecycleActor | null;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "Tidak ditemukan" };
  if (existing.status === "LEFT") return { ok: true };

  const toStatus = softDeleteStatus();
  const fields = lifecycleFieldsForStatus(toStatus);
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...fields,
      authVersion: { increment: 1 },
    },
  });
  await recordUserLifecycleEvent({
    userId: existing.id,
    event: "USER_LEFT",
    fromStatus: existing.status,
    toStatus,
    reason: opts.reason ?? "soft_delete",
    actor: opts.actor,
  });
  return { ok: true };
}

/** Soft-delete banyak user yang belum LEFT. */
export async function softDeleteUsersByIds(opts: {
  ids: string[];
  actor?: LifecycleActor | null;
  reason?: string;
}): Promise<number> {
  const targets = await prisma.user.findMany({
    where: { id: { in: opts.ids }, status: { not: "LEFT" } },
    select: { id: true, status: true },
  });
  return applySoftDeleteBatch(targets, opts.actor, opts.reason ?? "bulk_soft_delete");
}

export async function softDeleteStudentsByClassId(opts: {
  classId: string;
  actor?: LifecycleActor | null;
  reason?: string;
}): Promise<number> {
  const targets = await prisma.user.findMany({
    where: { role: "STUDENT", classId: opts.classId, status: { not: "LEFT" } },
    select: { id: true, status: true },
  });
  return applySoftDeleteBatch(targets, opts.actor, opts.reason ?? "class_soft_delete");
}

async function applySoftDeleteBatch(
  targets: { id: string; status: UserStatus }[],
  actor?: LifecycleActor | null,
  reason = "bulk_soft_delete"
): Promise<number> {
  if (targets.length === 0) return 0;
  const now = new Date();
  await prisma.$transaction(
    targets.map((t) =>
      prisma.user.update({
        where: { id: t.id },
        data: {
          status: "LEFT",
          active: false,
          leftAt: now,
          authVersion: { increment: 1 },
        },
      })
    )
  );
  await Promise.all(
    targets.map((t) =>
      recordUserLifecycleEvent({
        userId: t.id,
        event: "USER_LEFT",
        fromStatus: t.status,
        toStatus: "LEFT",
        reason,
        actor,
      })
    )
  );
  return targets.length;
}

export function activeSuperAdminWhere(excludeId?: string): Prisma.UserWhereInput {
  return {
    role: "SUPER_ADMIN",
    ...ACTIVE_USER_WHERE,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
}
