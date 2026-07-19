import type { Prisma } from "@/generated/prisma/client";
import { AccessLogCategory, AccessLogPortal } from "@/generated/prisma/client";

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

export function buildAccessLogWhere(q: AccessLogQuery): Prisma.AccessLogWhereInput {
  const where: Prisma.AccessLogWhereInput = {};
  const and: Prisma.AccessLogWhereInput[] = [];

  if (q.from?.trim()) {
    const d = new Date(q.from.trim());
    if (!Number.isNaN(d.getTime())) and.push({ createdAt: { gte: d } });
  }
  if (q.to?.trim()) {
    const d = new Date(q.to.trim());
    if (!Number.isNaN(d.getTime())) {
      // include whole end day if date-only
      if (/^\d{4}-\d{2}-\d{2}$/.test(q.to.trim())) d.setHours(23, 59, 59, 999);
      and.push({ createdAt: { lte: d } });
    }
  }

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
