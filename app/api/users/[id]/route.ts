import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const updateData: any = {};
  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.password) updateData.password = await bcrypt.hash(body.password, 12);
  if (body.role) updateData.role = body.role;
  if (body.nisn !== undefined) updateData.nisn = body.nisn || null;
  if (body.nip !== undefined) updateData.nip = body.nip || null;
  if (body.classId !== undefined) updateData.classId = body.classId || null;
  if (body.active !== undefined) updateData.active = body.active;
  const user = await prisma.user.update({ where: { id: params.id }, data: updateData });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
