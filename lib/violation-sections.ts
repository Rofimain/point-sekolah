/** Master bagian jenis pelanggaran. */

export type ViolationBagianRow = {
  id: string;
  label: string;
  sortOrder: number;
  active?: boolean;
};

/** Default bawaan (fallback jika DB belum dimigrate). */
export const DEFAULT_VIOLATION_BAGIAN: ViolationBagianRow[] = [
  { id: "KELAKUAN", label: "Kelakuan", sortOrder: 0 },
  { id: "KERAJINAN", label: "Kerajinan", sortOrder: 1 },
  { id: "KERAPIHAN", label: "Kerapihan", sortOrder: 2 },
];

/** @deprecated Prefer catalog dari DB — tetap diekspor agar seed/sync lama tidak pecah. */
export const VIOLATION_SECTIONS = DEFAULT_VIOLATION_BAGIAN.map((b) => b.id) as readonly string[];
export type ViolationSection = string;

export const VIOLATION_SECTION_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_VIOLATION_BAGIAN.map((b) => [b.id, b.label])
);

export function slugifyBagianId(label: string): string {
  const base = label
    .trim()
    .toUpperCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `BAGIAN_${Date.now().toString(36).toUpperCase()}`;
}

export function getViolationSectionLabel(
  section: string | null | undefined,
  catalog: ViolationBagianRow[] = DEFAULT_VIOLATION_BAGIAN
): string {
  if (!section) return "Lainnya";
  const hit = catalog.find((b) => b.id === section);
  if (hit) return hit.label;
  return VIOLATION_SECTION_LABELS[section] || section;
}

export function sortViolationSections(
  a: string | null | undefined,
  b: string | null | undefined,
  catalog: ViolationBagianRow[] = DEFAULT_VIOLATION_BAGIAN
): number {
  const order = [...catalog.map((c) => c.id), ""];
  const ia = order.indexOf(a || "");
  const ib = order.indexOf(b || "");
  const na = ia === -1 ? 900 + (a || "").localeCompare(b || "") : ia;
  const nb = ib === -1 ? 900 : ib;
  if (ia === -1 && ib === -1) return (a || "").localeCompare(b || "", "id");
  return na - nb;
}

export function orderedSectionKeys(
  presentKeys: Iterable<string>,
  catalog: ViolationBagianRow[] = DEFAULT_VIOLATION_BAGIAN
): string[] {
  const set = new Set(presentKeys);
  const fromCatalog = catalog.map((c) => c.id).filter((id) => set.has(id));
  const extras = [...set].filter((k) => !fromCatalog.includes(k)).sort((a, b) => a.localeCompare(b, "id"));
  return [...fromCatalog, ...extras];
}

export function groupByViolationSection<T extends { section?: string | null }>(
  items: T[],
  catalog: ViolationBagianRow[] = DEFAULT_VIOLATION_BAGIAN
): { section: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.section || "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return orderedSectionKeys(map.keys(), catalog).map((section) => ({
    section,
    items: map.get(section)!,
  }));
}
