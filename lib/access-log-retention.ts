/** Retensi log akses: simpan 1 tahun, lebih tua dihapus (ISO-friendly). */
export const ACCESS_LOG_RETAIN_MONTHS = 12;

export function monthsAgo(months: number, now = new Date()): Date {
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Batas bawah data yang masih disimpan (≥ 12 bulan terakhir). */
export function accessLogRetainSince(now = new Date()): Date {
  return monthsAgo(ACCESS_LOG_RETAIN_MONTHS, now);
}

/** Alias tampilan UI = masa retensi (tidak ada arsip terpisah). */
export function accessLogActiveSince(now = new Date()): Date {
  return accessLogRetainSince(now);
}
