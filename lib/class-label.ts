/** Label tampilan kelas — pakai `name` (sudah lengkap, mis. "X MIPA 1"). */
export function formatClassLabel(
  c: { name?: string | null; grade?: string | null; major?: string | null } | null | undefined,
  fallback = "—"
): string {
  if (!c) return fallback;
  const name = c.name?.trim();
  if (name) return name;
  const parts = [c.grade?.trim(), c.major?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : fallback;
}
