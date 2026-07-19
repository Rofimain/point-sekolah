import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildAccessLogWhere, parseAccessLogQuery } from "@/lib/access-log-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin();
  if (isAuthFail(auth)) return auth.response;

  const q = parseAccessLogQuery(req.nextUrl.searchParams);
  const where = buildAccessLogWhere(q);
  const skip = ((q.page ?? 1) - 1) * (q.perPage ?? 30);

  const [total, items] = await Promise.all([
    prisma.accessLog.count({ where }),
    prisma.accessLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: q.perPage ?? 30,
    }),
  ]);

  return NextResponse.json(
    {
      items,
      total,
      page: q.page,
      perPage: q.perPage,
      totalPages: Math.max(1, Math.ceil(total / (q.perPage ?? 30))),
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
