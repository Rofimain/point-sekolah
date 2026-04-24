/** Tahun ajaran Jul–Jun umum di Indonesia, mis. Juli 2025 → "2025/2026". */
export function indonesianAcademicYearLabel(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 6 ? y : y - 1;
  return `${start}/${start + 1}`;
}
