import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

/** Cari siswa aktif untuk alur cetak surat (nama / NISN / kelas). */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      active: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nisn: { contains: q, mode: "insensitive" } },
        { class: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 20,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      nisn: true,
      class: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: items.map((s) => ({
      id: s.id,
      name: s.name,
      nisn: s.nisn,
      className: s.class?.name ?? null,
    })),
  });
}
