/** Bagian Pasal 15 — Pedoman Penilaian Sikap / Budi Pekerti */
export const VIOLATION_SECTIONS = ["KELAKUAN", "KERAJINAN", "KERAPIHAN"] as const;
export type ViolationSection = (typeof VIOLATION_SECTIONS)[number];

export const VIOLATION_SECTION_LABELS: Record<ViolationSection, string> = {
  KELAKUAN: "I. Kelakuan",
  KERAJINAN: "II. Kerajinan",
  KERAPIHAN: "III. Kerapihan",
};

export function getViolationSectionLabel(section: string | null | undefined): string {
  if (!section) return "Lainnya";
  return VIOLATION_SECTION_LABELS[section as ViolationSection] || section;
}

/** Urutan tampilan optgroup / filter. */
export function sortViolationSections(a: string | null | undefined, b: string | null | undefined): number {
  const order = [...VIOLATION_SECTIONS, ""];
  const ia = order.indexOf((a || "") as ViolationSection);
  const ib = order.indexOf((b || "") as ViolationSection);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
}
