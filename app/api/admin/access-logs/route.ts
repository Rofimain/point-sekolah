import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/staff-roles";
import { buildAccessLogWhere, parseAccessLogQuery } from "@/lib/access-log-query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
