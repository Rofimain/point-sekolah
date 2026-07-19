import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordDataAccessLog } from "@/lib/access-log";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

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
  await recordDataAccessLog({
    session,
    action: "CLASS_DELETE",
    summary: `Hapus kelas ${cls.name}`,
    targetType: "Class",
    targetId: cls.id,
  });
  return NextResponse.json({ ok: true, removedClassName: cls.name });
}
