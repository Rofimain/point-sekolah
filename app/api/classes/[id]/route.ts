import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = rawId?.trim();
  if (!id) {
    return NextResponse.json({ error: "ID kelas tidak valid" }, { status: 400 });
  }

  const cls = await prisma.class.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!cls) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.user.updateMany({ where: { classId: id }, data: { classId: null } }),
    prisma.class.delete({ where: { id } }),
  ]);

  revalidateTag("sidebar-classes", { expire: 0 });
  return NextResponse.json({ ok: true, removedClassName: cls.name });
}
