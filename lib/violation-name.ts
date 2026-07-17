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
