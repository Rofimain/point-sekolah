import { prisma } from "@/lib/prisma";
import type { AccessLogCategory, AccessLogPortal } from "@/generated/prisma/client";
import { getAuthRequestMeta } from "@/lib/auth-request-meta";
import {
  accessLogActorFromSession,
  portalFromActorRole,
  type AccessLogActor,
} from "@/lib/access-log-meta";

export {
  accessLogActorFromSession,
  portalFromActorRole,
  portalFromAuthProvider,
  type AccessLogActor,
} from "@/lib/access-log-meta";

export type RecordAccessLogInput = {
  portal: AccessLogPortal;
  category: AccessLogCategory;
  action: string;
  success?: boolean;
  actor?: AccessLogActor | null;
  targetType?: string | null;
  targetId?: string | null;
  summary: string;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
};

function safeMetaJson(meta: Record<string, unknown> | null | undefined): string | undefined {
  if (!meta || Object.keys(meta).length === 0) return undefined;
  try {
    return JSON.stringify(meta).slice(0, 8000);
  } catch {
    return undefined;
  }
}

/** Tulis AccessLog; gagal tulis tidak boleh menggagalkan request utama. */
export async function recordAccessLog(input: RecordAccessLogInput): Promise<void> {
  try {
    await prisma.accessLog.create({
      data: {
        portal: input.portal,
        category: input.category,
        action: input.action.slice(0, 64),
        success: input.success !== false,
        actorId: input.actor?.id ?? undefined,
        actorName: input.actor?.name ? String(input.actor.name).slice(0, 191) : undefined,
        actorRole: input.actor?.role ? String(input.actor.role).slice(0, 64) : undefined,
        targetType: input.targetType ? String(input.targetType).slice(0, 64) : undefined,
        targetId: input.targetId ? String(input.targetId).slice(0, 191) : undefined,
        summary: input.summary.slice(0, 500),
        meta: safeMetaJson(input.meta),
        ip: input.ip ? String(input.ip).slice(0, 64) : undefined,
        userAgent: input.userAgent ? String(input.userAgent).slice(0, 512) : undefined,
      },
    });
  } catch (err) {
    console.error("[access-log] gagal menulis AccessLog", err);
  }
}

/** Convenience: ambil IP/UA lalu tulis log DATA dari session. */
export async function recordDataAccessLog(opts: {
  session: { user?: { id?: string | null; name?: string | null; role?: string | null } | null } | null;
  action: string;
  summary: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  success?: boolean;
  portal?: AccessLogPortal;
}): Promise<void> {
  const meta = await getAuthRequestMeta();
  const actor = accessLogActorFromSession(opts.session);
  await recordAccessLog({
    portal: opts.portal ?? portalFromActorRole(actor?.role),
    category: "DATA",
    action: opts.action,
    success: opts.success,
    actor,
    targetType: opts.targetType,
    targetId: opts.targetId,
    summary: opts.summary,
    meta: opts.meta,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}
