import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { violationNameSortOrder } from "@/lib/violation-name";
import { Prisma } from "@/generated/prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const usage = await prisma.violationRecord.count({ where: { violationTypeId: id } });
  if (usage === 0) {
    await prisma.violationType.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Masih dipakai riwayat → nonaktifkan saja
  try {
    await prisma.violationType.update({ where: { id }, data: { active: false } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true, deleted: false, deactivated: true });
}
