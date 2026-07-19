import { NextRequest, NextResponse } from "next/server";
import { requireManageData, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { violationNameSortOrder } from "@/lib/violation-name";
import { Prisma } from "@/generated/prisma/client";
import { recordDataAccessLog } from "@/lib/access-log";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;
  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const updated = await prisma.violationType.update({
    where: { id },
    data: {
      name,
      category: body.category,
      points: parseInt(body.points, 10),
      description: body.description || null,
      section: body.section ?? undefined,
      ...(name ? { sortOrder: violationNameSortOrder(name) } : {}),
      active: true,
    },
  });
  await recordDataAccessLog({
    session,
    action: "VIOLATION_UPDATE",
    summary: `Ubah jenis pelanggaran ${updated.name}`,
    targetType: "ViolationType",
    targetId: updated.id,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageData();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;

  const usage = await prisma.violationRecord.count({ where: { violationTypeId: id } });
  if (usage === 0) {
    await prisma.violationType.delete({ where: { id } });
    await recordDataAccessLog({
      session,
      action: "VIOLATION_DELETE",
      summary: `Hapus jenis pelanggaran ${id}`,
      targetType: "ViolationType",
      targetId: id,
    });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Masih dipakai riwayat → nonaktifkan saja
  try {
    await prisma.violationType.update({ where: { id }, data: { active: false } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });
    }
    console.error("[violations DELETE]", e);
    return NextResponse.json({ error: "Gagal menonaktifkan jenis pelanggaran." }, { status: 500 });
  }
  await recordDataAccessLog({
    session,
    action: "VIOLATION_DEACTIVATE",
    summary: `Nonaktifkan jenis pelanggaran ${id}`,
    targetType: "ViolationType",
    targetId: id,
  });
  return NextResponse.json({ ok: true, deleted: false, deactivated: true });
}
