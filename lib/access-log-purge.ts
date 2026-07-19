import { prisma } from "@/lib/prisma";
import { accessLogRetainSince } from "@/lib/access-log-retention";

/**
 * Hapus AccessLog (+ AuthLoginEvent) yang lebih tua dari 12 bulan.
 * Dipanggil cron harian.
 */
export async function purgeExpiredAccessLogs(now = new Date()): Promise<{
  accessLogsDeleted: number;
  authLoginEventsDeleted: number;
  cutoff: string;
}> {
  const cutoff = accessLogRetainSince(now);
  const [access, auth] = await Promise.all([
    prisma.accessLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.authLoginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);
  return {
    accessLogsDeleted: access.count,
    authLoginEventsDeleted: auth.count,
    cutoff: cutoff.toISOString(),
  };
}
