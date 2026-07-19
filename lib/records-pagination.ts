/**
 * Pure pagination clamp used by GET /api/records (staff).
 * Extracted for unit tests — must stay in sync with app/api/records/route.ts.
 */
export function parseRecordsListPagination(searchParams: {
  get(name: string): string | null;
}): { page: number; perPage: number; skip: number } {
  const pageRaw = parseInt(searchParams.get("page") || "1", 10);
  const perPageRaw = parseInt(searchParams.get("perPage") || "50", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const perPage = Math.min(100, Math.max(1, Number.isFinite(perPageRaw) ? perPageRaw : 50));
  return { page, perPage, skip: (page - 1) * perPage };
}
