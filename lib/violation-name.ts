/** Pisahkan prefix `[89A]` dari nama pelanggaran. */
export function splitViolationName(full: string): { code: string; title: string } {
  const m = full.trim().match(/^\[([^\]]+)\]\s*(.*)$/);
  if (m) return { code: m[1].trim(), title: (m[2] || "").trim() };
  return { code: "", title: full.trim() };
}

export function joinViolationName(code: string, title: string): string {
  const t = title.trim();
  const c = code.trim();
  if (!c) return t;
  return `[${c}] ${t}`;
}

/**
 * Urutan numerik dari kode (mis. 12A → setelah 12, sebelum 13).
 * Dipakai sebagai `sortOrder` agar item baru tidak selalu di atas.
 */
export function violationCodeSortOrder(code: string): number {
  const m = code.trim().match(/^(\d+)([A-Za-z]*)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n)) return 0;
  const letters = m[2].toUpperCase();
  let suffix = 0;
  for (let i = 0; i < letters.length; i++) {
    suffix = suffix * 26 + (letters.charCodeAt(i) - 64);
  }
  return n * 1000 + suffix;
}

export function violationNameSortOrder(name: string): number {
  return violationCodeSortOrder(splitViolationName(name).code);
}
