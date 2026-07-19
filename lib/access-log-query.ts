import type { Prisma } from "@/generated/prisma/client";
import { AccessLogCategory, AccessLogPortal } from "@/generated/prisma/client";
import { accessLogRetainSince } from "@/lib/access-log-retention";

export type AccessLogQuery = {
  from?: string | null;
  to?: string | null;
  category?: string | null;
  portal?: string | null;
  action?: string | null;
  q?: string | null;
  page?: number;
  perPage?: number;
};

export function parseAccessLogQuery(sp: URLSearchParams): AccessLogQuery {
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const perPageRaw = parseInt(sp.get("perPage") || "30", 10) || 30;
  const perPage = Math.min(50, Math.max(1, perPageRaw));
  return {
    from: sp.get("from"),
    to: sp.get("to"),
    category: sp.get("category"),
    portal: sp.get("portal"),
    action: sp.get("action"),
    q: sp.get("q"),
    page,
    perPage,
  };
}

function parseDayStart(raw: string): Date | null {
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEnd(raw: string): Date | null {
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) d.setHours(23, 59, 59, 999);
  return d;
}

/** Filter list: selalu dibatasi masa retensi 12 bulan (+ from/to opsional di dalamnya). */
export function buildAccessLogWhere(q: AccessLogQuery, now = new Date()): Prisma.AccessLogWhereInput {
  const where: Prisma.AccessLogWhereInput = {};
  const and: Prisma.AccessLogWhereInput[] = [];

  let gte = accessLogRetainSince(now);
  let lte: Date | undefined;

  if (q.from?.trim()) {
    const from = parseDayStart(q.from);
    if (from && from > gte) gte = from;
  }
  if (q.to?.trim()) {
    const to = parseDayEnd(q.to);
    if (to) lte = to;
  }

  and.push({ createdAt: { gte } });
  if (lte) and.push({ createdAt: { lte } });

  if (q.category && (Object.values(AccessLogCategory) as string[]).includes(q.category)) {
    where.category = q.category as AccessLogCategory;
  }
  if (q.portal && (Object.values(AccessLogPortal) as string[]).includes(q.portal)) {
    where.portal = q.portal as AccessLogPortal;
  }
  if (q.action?.trim()) {
    where.action = { contains: q.action.trim(), mode: "insensitive" };
  }
  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({
      OR: [
        { summary: { contains: term, mode: "insensitive" } },
        { actorName: { contains: term, mode: "insensitive" } },
        { actorRole: { contains: term, mode: "insensitive" } },
        { targetId: { contains: term, mode: "insensitive" } },
        { action: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}
