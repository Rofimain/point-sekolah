import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { points, notes, violationTypeId } = body;
  const updated = await prisma.violationRecord.update({
    where: { id: params.id },
    data: { ...(points !== undefined && { points }), ...(notes !== undefined && { notes }), ...(violationTypeId && { violationTypeId }) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.violationRecord.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
