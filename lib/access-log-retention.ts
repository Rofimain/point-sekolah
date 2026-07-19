/** Retensi log akses (ISO-friendly untuk app sekolah). */
export const ACCESS_LOG_ACTIVE_MONTHS = 12;
export const ACCESS_LOG_RETAIN_MONTHS = 24;

export type AccessLogScope = "active" | "archive";

export function monthsAgo(months: number, now = new Date()): Date {
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Batas bawah tampilan aktif (≥ 12 bulan terakhir). */
export function accessLogActiveSince(now = new Date()): Date {
  return monthsAgo(ACCESS_LOG_ACTIVE_MONTHS, now);
}

/** Batas bawah arsip (≥ 24 bulan); di bawah ini di-purge. */
export function accessLogRetainSince(now = new Date()): Date {
  return monthsAgo(ACCESS_LOG_RETAIN_MONTHS, now);
}

/**
 * Window tanggal untuk scope UI.
 * - active: [now-12m, ∞)
 * - archive: [now-24m, now-12m)
 */
export function accessLogScopeWindow(
  scope: AccessLogScope,
  now = new Date()
): { gte: Date; lt?: Date } {
  if (scope === "archive") {
    return { gte: accessLogRetainSince(now), lt: accessLogActiveSince(now) };
  }
  return { gte: accessLogActiveSince(now) };
}

export function parseAccessLogScope(raw: string | null | undefined): AccessLogScope {
  return raw === "archive" ? "archive" : "active";
}
