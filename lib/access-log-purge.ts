import { prisma } from "@/lib/prisma";
import { accessLogRetainSince } from "@/lib/access-log-retention";

/**
 * Hapus AccessLog (+ AuthLoginEvent) yang lebih tua dari masa retensi 24 bulan.
 * Dipanggil cron; gagal sebagian tidak throw kecuali error DB kritis.
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
