/** Util tanggal review pembaharuan (jenis pelanggaran / roster). */

export function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Tambah bulan kalender dari tanggal dasar (atau hari ini bila kosong/invalid). */
export function addMonthsFromYmd(baseYmd: string, months: number, from = new Date()): string {
  const base = parseYmd(baseYmd) ?? from;
  const next = new Date(base.getFullYear(), base.getMonth() + months, base.getDate());
  return formatYmd(next);
}

export function isReviewOverdue(ymd: string, today = new Date()): boolean {
  const d = parseYmd(ymd);
  if (!d) return false;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d < t;
}

export function reviewStatusLabel(ymd: string): "ok" | "soon" | "overdue" | "empty" {
  if (!ymd.trim()) return "empty";
  const d = parseYmd(ymd);
  if (!d) return "empty";
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (d < today) return "overdue";
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  if (d <= in30) return "soon";
  return "ok";
}
