import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { parseParentTelegramForDb } from "@/lib/parent-telegram-field";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { assertCanDeleteSuperAdmin, assertCanDemoteSuperAdmin, LAST_ACTIVE_SA_MSG } from "@/lib/super-admin-policy";

const VALID_ROLES = new Set<string>(Object.values(Role));

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const body = await req.json();

  if (body.role !== undefined && !VALID_ROLES.has(String(body.role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }

  const nextRole = (body.role !== undefined ? String(body.role) : existing.role) as Role;
  const nextActive = body.active !== undefined ? Boolean(body.active) : existing.active;

  if (existing.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const err = await assertCanDemoteSuperAdmin(params.id);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  /** Setelah update: minimal 1 Super Admin aktif (selain baris ini jika ia SA nonaktif). */
  if (nextRole === "SUPER_ADMIN" && nextActive === false) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", active: true, id: { not: params.id } },
    });
    if (otherActive < 1) {
      return NextResponse.json({ error: LAST_ACTIVE_SA_MSG }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.password) updateData.password = await bcrypt.hash(body.password, 12);
  if (body.role !== undefined) {
    updateData.role = body.role as Role;
  }
  if (body.nisn !== undefined) updateData.nisn = body.nisn || null;
  if (body.nip !== undefined) updateData.nip = body.nip || null;
  if (body.active !== undefined) updateData.active = body.active;

  const nextRoleResolved = (updateData.role as Role | undefined) ?? existing.role;

  if (nextRoleResolved === "STUDENT" || nextRoleResolved === "WALI_KELAS") {
    if (body.classId !== undefined) updateData.classId = body.classId || null;
  } else {
    updateData.classId = null;
  }

  if (nextRoleResolved === "STUDENT") {
    if (body.parentTelegram !== undefined) {
      const pt = parseParentTelegramForDb(body.parentTelegram);
      if (!pt.ok) return NextResponse.json({ error: pt.error }, { status: 400 });
      updateData.parentTelegram = pt.value;
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
  const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const delErr = await assertCanDeleteSuperAdmin(params.id);
  if (delErr) return NextResponse.json({ error: delErr }, { status: 400 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
