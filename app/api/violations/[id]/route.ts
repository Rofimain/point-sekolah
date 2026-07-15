import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const updated = await prisma.violationType.update({ where: { id: params.id }, data: { name: body.name, category: body.category, points: parseInt(body.points), description: body.description || null } });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.violationType.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
