import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/same-origin";

/** Invalidate semua sesi JWT akun ini (bump authVersion). */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 403 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { authVersion: { increment: 1 } },
  });

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
