import { NextRequest, NextResponse } from "next/server";
import { requireManageUsers, isAuthFail } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role, UserStatus } from "@/generated/prisma/client";
import { newParentLinkToken } from "@/lib/parent-telegram-link";
import { assertCanDemoteSuperAdmin, LAST_ACTIVE_SA_MSG } from "@/lib/super-admin-policy";
import { canDeleteUser, canModifyUser, canCreateUserWithRole, isAdminRole } from "@/lib/staff-roles";
import { validateNewPassword } from "@/lib/password-policy";
import { parseUserPhotoPatch } from "@/lib/user-photo";
import { ACTIVE_USER_WHERE, lifecycleFieldsForStatus, statusFromActiveToggle } from "@/lib/user-status";
import { recordUserLifecycleEvent } from "@/lib/user-lifecycle-audit";
import { softDeleteUser } from "@/lib/user-soft-delete";
import { recordDataAccessLog } from "@/lib/access-log";

const VALID_ROLES = new Set<string>(Object.values(Role));
const VALID_STATUSES = new Set<string>(Object.values(UserStatus));

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageUsers();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;
  const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });

  const body = await req.json();

  if (body.role !== undefined && !VALID_ROLES.has(String(body.role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_STATUSES.has(String(body.status))) {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }

  const nextRole = (body.role !== undefined ? String(body.role) : existing.role) as Role;

  let nextStatus = existing.status;
  if (body.status !== undefined) {
    nextStatus = String(body.status) as UserStatus;
  } else if (body.active !== undefined) {
    nextStatus = statusFromActiveToggle(Boolean(body.active));
  }

  const adminEditingSelf = isAdminRole(session.user.role) && existing.id === session.user.id;
  const teacherEditingSelf = session.user.role === "TEACHER" && existing.id === session.user.id;

  if (
    (!canModifyUser(session.user.role, existing.role) && !adminEditingSelf && !teacherEditingSelf) ||
    (body.role !== undefined &&
      String(body.role) !== existing.role &&
      !canCreateUserWithRole(session.user.role, String(body.role)))
  ) {
    return NextResponse.json(
      { error: "Anda tidak boleh mengubah akun dengan level sama atau lebih tinggi." },
      { status: 403 }
    );
  }
  if ((adminEditingSelf || teacherEditingSelf) && (nextRole !== existing.role || nextStatus !== existing.status)) {
    return NextResponse.json({ error: "Anda tidak boleh mengubah role atau status akunnya sendiri." }, { status: 403 });
  }

  if (existing.role === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN") {
    const err = await assertCanDemoteSuperAdmin(id);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  /** Setelah update: minimal 1 Super Admin aktif. */
  if (nextRole === "SUPER_ADMIN" && nextStatus !== "ACTIVE") {
    const otherActive = await prisma.user.count({
      where: { role: "SUPER_ADMIN", ...ACTIVE_USER_WHERE, id: { not: id } },
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
    /** Reset admin → paksa ganti password saat login credentials berikutnya. */
    updateData.passwordChangedAt = null;
    updateData.failedLoginCount = 0;
    updateData.lockedUntil = null;
  }
  if (body.role !== undefined) {
    updateData.role = body.role as Role;
  }
  if (body.nisn !== undefined) updateData.nisn = body.nisn || null;
  if (body.nip !== undefined) updateData.nip = body.nip || null;
  if (body.lastAcademicYear !== undefined) {
    updateData.lastAcademicYear =
      typeof body.lastAcademicYear === "string" && body.lastAcademicYear.trim() ? body.lastAcademicYear.trim() : null;
  }

  if (nextStatus !== existing.status || body.active !== undefined || body.status !== undefined) {
    Object.assign(updateData, lifecycleFieldsForStatus(nextStatus));
    if (nextStatus !== "ACTIVE") {
      updateData.authVersion = { increment: 1 };
    }
  }

  const nextRoleResolved = (updateData.role as Role | undefined) ?? existing.role;

  if (nextRoleResolved === "STUDENT") {
    if (body.classId !== undefined) updateData.classId = body.classId || null;
    updateData.nip = null;
    updateData.jabatan = null;
  } else {
    updateData.classId = null;
    updateData.nisn = null;
    if (body.jabatan !== undefined) {
      updateData.jabatan =
        typeof body.jabatan === "string" && body.jabatan.trim() ? body.jabatan.trim().slice(0, 120) : null;
    }
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

  const photo = parseUserPhotoPatch(body.photoData);
  if (photo && "error" in photo) {
    return NextResponse.json({ error: photo.error }, { status: 400 });
  }
  if (photo) {
    updateData.photoData = photo.photoData;
    updateData.photoPresent = photo.photoPresent;
  }

  const user = await prisma.user.update({ where: { id }, data: updateData as never });

  if (nextStatus !== existing.status) {
    let event = "USER_STATUS_CHANGED";
    if (nextStatus === "ACTIVE") event = "USER_ACTIVATED";
    else if (nextStatus === "SUSPENDED" || nextStatus === "INACTIVE") event = "USER_DEACTIVATED";
    else if (nextStatus === "GRADUATED") event = "USER_GRADUATED";
    else if (nextStatus === "LEFT") event = "USER_LEFT";
    await recordUserLifecycleEvent({
      userId: id,
      event,
      fromStatus: existing.status,
      toStatus: nextStatus,
      reason: body.status !== undefined ? "admin_set_status" : "admin_active_toggle",
      actor: { id: session.user.id, name: session.user.name },
    });
  }

  await recordDataAccessLog({
    session,
    action: "USER_UPDATE",
    summary: `Mengubah pengguna ${user.name}`,
    targetType: "User",
    targetId: user.id,
    meta: {
      role: user.role,
      status: user.status,
      fields: Object.keys(body).filter((k) => !["password", "photoData"].includes(k)),
    },
  });

  const { password: _, parentTelegramLinkToken: __, photoData: ___, ...safe } = user;
  return NextResponse.json(safe);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireManageUsers();
  if (isAuthFail(auth)) return auth.response;
  const { session } = auth;
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!existing) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (existing.id === session.user.id) {
    return NextResponse.json({ error: "Tidak boleh menghapus akun sendiri." }, { status: 403 });
  }
  if (!canDeleteUser(session.user.role, existing.role)) {
    return NextResponse.json(
      { error: "Anda tidak boleh menghapus akun dengan level sama atau lebih tinggi." },
      { status: 403 }
    );
  }
  const result = await softDeleteUser({ userId: id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await recordDataAccessLog({
    session,
    action: "USER_DELETE",
    summary: `Soft-delete ${existing.name} (${existing.role})`,
    targetType: "User",
    targetId: existing.id,
    meta: { role: existing.role, email: existing.email },
  });
  return NextResponse.json({ ok: true, softDeleted: true });
}
