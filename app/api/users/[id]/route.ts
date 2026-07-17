import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { assertCanDeleteSuperAdmin, assertCanDemoteSuperAdmin, LAST_ACTIVE_SA_MSG } from "@/lib/super-admin-policy";
import { canDeleteUser, canManageData, canModifyUser, isAdminRole } from "@/lib/staff-roles";
import { validateNewPassword } from "@/lib/password-policy";
import { isStrictEvidenceImageDataUrl } from "@/lib/evidence-data-url";

const VALID_ROLES = new Set<string>(Object.values(Role));

function parsePhotoPatch(value: unknown): { photoData: string | null; photoPresent: boolean } | { error: string } | null {
  if (value === undefined) return null;
  if (value === null || value === "") return { photoData: null, photoPresent: false };
  if (typeof value !== "string" || !isStrictEvidenceImageDataUrl(value)) {
    return { error: "Format foto tidak valid. Gunakan JPEG atau PNG." };
  }
  return { photoData: value.trim(), photoPresent: true };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const body = await req.json();

  if (body.role !== undefined && !VALID_ROLES.has(String(body.role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }

  const nextRole = (body.role !== undefined ? String(body.role) : existing.role) as Role;
  const nextActive = body.active !== undefined ? Boolean(body.active) : existing.active;
  const adminEditingSelf = isAdminRole(session.user.role) && existing.id === session.user.id;

  if (
    (!canModifyUser(session.user.role, existing.role) && !adminEditingSelf) ||
    (isAdminRole(session.user.role) && nextRole === "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Admin tidak boleh mengubah akun Admin atau Super Admin." }, { status: 403 });
  }
  if (adminEditingSelf && (nextRole !== existing.role || nextActive !== existing.active)) {
    return NextResponse.json({ error: "Admin tidak boleh mengubah role atau status akunnya sendiri." }, { status: 403 });
  }

  if (existing.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const err = await assertCanDemoteSuperAdmin(id);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  /** Setelah update: minimal 1 Super Admin aktif (selain baris ini jika ia SA nonaktif). */
  if (nextRole === "SUPER_ADMIN" && nextActive === false) {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", active: true, id: { not: id } },
    });
    if (otherActive < 1) {
      return NextResponse.json({ error: LAST_ACTIVE_SA_MSG }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.name) updateData.name = body.name;
  if (body.email) updateData.email = body.email;
  if (body.password) {
    const nextPassword = validateNewPassword(body.password);
    if (!nextPassword.ok) return NextResponse.json({ error: nextPassword.error }, { status: 400 });
    updateData.password = await bcrypt.hash(nextPassword.value, 12);
    updateData.authVersion = { increment: 1 };
  }
  if (body.role !== undefined) {
    updateData.role = body.role as Role;
  }
  if (body.nisn !== undefined) updateData.nisn = body.nisn || null;
  if (body.nip !== undefined) updateData.nip = body.nip || null;
  if (body.active !== undefined) updateData.active = body.active;

  const nextRoleResolved = (updateData.role as Role | undefined) ?? existing.role;

  if (nextRoleResolved === "STUDENT" || nextRoleResolved === "TEACHER") {
    if (body.classId !== undefined) updateData.classId = body.classId || null;
  } else {
    updateData.classId = null;
  }

  if (nextRoleResolved === "STUDENT") {
    if (existing.role !== "STUDENT") {
      updateData.parentTelegramLinkToken = newParentLinkToken();
      updateData.parentTelegram = null;
    }
  } else {
    updateData.parentTelegram = null;
    updateData.parentTelegramLinkToken = null;
  }

  const photo = parsePhotoPatch(body.photoData);
  if (photo && "error" in photo) {
    return NextResponse.json({ error: photo.error }, { status: 400 });
  }
  if (photo) {
    updateData.photoData = photo.photoData;
    updateData.photoPresent = photo.photoPresent;
  }

  const user = await prisma.user.update({ where: { id }, data: updateData as any });
  const { password: _, parentTelegramLinkToken: __, photoData: ___, ...safe } = user;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (!canDeleteUser(session.user.role, existing.role)) {
    return NextResponse.json({ error: "Admin tidak boleh menghapus akun Admin atau Super Admin." }, { status: 403 });
  }
  const delErr = await assertCanDeleteSuperAdmin(id);
  if (delErr) return NextResponse.json({ error: delErr }, { status: 400 });
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
