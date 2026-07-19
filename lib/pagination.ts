/**
 * Nomor halaman yang ditampilkan di UI (jendela geser di sekitar halaman aktif).
 * Selalu mencakup halaman saat ini; tidak memotong akses ke halaman tinggi.
 */
export function visiblePageNumbers(current: number, total: number, maxButtons = 7): number[] {
  if (total < 1) return [];
  const cur = Math.min(Math.max(1, Math.trunc(current) || 1), total);
  if (total <= maxButtons) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, cur - half);
  let end = start + maxButtons - 1;
  if (end > total) {
    end = total;
    start = Math.max(1, end - maxButtons + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
