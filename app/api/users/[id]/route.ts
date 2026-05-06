import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { normalizeParentTelegram } from "@/lib/student-upsert";
import { newParentLinkToken } from "@/lib/parent-telegram-link";

const VALID_ROLES = new Set<string>(Object.values(Role));

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const body = await req.json();

  if (existing.role === "SUPER_ADMIN" && body.active === false) {
    return NextResponse.json({ error: "Akun Super Admin tidak boleh dinonaktifkan." }, { status: 400 });
  }
  if (
    existing.role === "SUPER_ADMIN" &&
    body.role !== undefined &&
    String(body.role) !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Role Super Admin tidak dapat diubah." }, { status: 400 });
  }
  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.password) updateData.password = await bcrypt.hash(body.password, 12);
  if (body.role !== undefined) {
    if (!VALID_ROLES.has(String(body.role))) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    updateData.role = body.role as Role;
  }
  if (body.nisn !== undefined) updateData.nisn = body.nisn || null;
  if (body.nip !== undefined) updateData.nip = body.nip || null;
  if (body.active !== undefined) updateData.active = body.active;

  const nextRole = (updateData.role as Role | undefined) ?? existing.role;

  if (nextRole === "STUDENT" || nextRole === "WALI_KELAS") {
    if (body.classId !== undefined) updateData.classId = body.classId || null;
  } else {
    updateData.classId = null;
  }

  if (nextRole === "STUDENT") {
    if (body.parentTelegram !== undefined) {
      updateData.parentTelegram = normalizeParentTelegram(body.parentTelegram) ?? null;
    }
    if (existing.role !== "STUDENT" && updateData.role === "STUDENT") {
      updateData.parentTelegramLinkToken = newParentLinkToken();
    }
  } else {
    updateData.parentTelegram = null;
    updateData.parentTelegramLinkToken = null;
  }

  const user = await prisma.user.update({ where: { id: params.id }, data: updateData as any });
  const { password: _, parentTelegramLinkToken: __, ...safe } = user;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (existing.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Akun Super Admin tidak boleh dihapus." }, { status: 400 });
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
