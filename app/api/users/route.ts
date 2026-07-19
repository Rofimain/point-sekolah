import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";
import { LAST_ACTIVE_SA_MSG } from "@/lib/super-admin-policy";
import {
  canCreateUserWithRole,
  canDeleteUser,
  canManageUsers,
  canModifyUser,
} from "@/lib/staff-roles";
import { parseUserPhotoInput } from "@/lib/user-photo";
import { validateNewPassword } from "@/lib/password-policy";
import { ACTIVE_USER_WHERE, lifecycleFieldsForStatus, statusFromActiveToggle } from "@/lib/user-status";
import { recordUserLifecycleEvent } from "@/lib/user-lifecycle-audit";
import { softDeleteStudentsByClassId, softDeleteUsersByIds } from "@/lib/user-soft-delete";
import { getTelegramBotUsername } from "@/lib/telegram-bot-username";
import { recordDataAccessLog } from "@/lib/access-log";

const VALID_ROLES = new Set<string>(Object.values(Role));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { name, email, password, role, nisn, nip, classId, active, photoData } = body;
  if (!name || !email || !password) return NextResponse.json({ error: "Nama, email, password wajib" }, { status: 400 });
  if (!role || !VALID_ROLES.has(String(role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }
  if (!canCreateUserWithRole(session.user.role, String(role))) {
    return NextResponse.json(
      { error: "Anda tidak boleh membuat akun dengan role tersebut." },
      { status: 403 }
    );
  }
  const nextPassword = validateNewPassword(password);
  if (!nextPassword.ok) return NextResponse.json({ error: nextPassword.error }, { status: 400 });
  const photo = parseUserPhotoInput(photoData);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: 400 });
  const existing = await prisma.user.findFirst({
    where: { email, deletedAt: null },
  });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const hashed = await bcrypt.hash(nextPassword.value, 12);
  const r = role as Role;
  const wantActive = active ?? true;
  const statusFields = lifecycleFieldsForStatus(statusFromActiveToggle(Boolean(wantActive)));
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: r,
      nisn: r === "STUDENT" ? nisn || null : null,
      nip: r === "STUDENT" ? null : nip || null,
      classId: r === "STUDENT" ? classId || null : null,
      parentTelegram: null,
      parentTelegramLinkToken: r === "STUDENT" ? newParentLinkToken() : null,
      ...statusFields,
      createdFrom: "MANUAL",
      passwordChangedAt: new Date(),
      photoData: photo.photoData,
      photoPresent: photo.photoPresent,
    },
  });
  await recordUserLifecycleEvent({
    userId: user.id,
    event: "USER_CREATED",
    toStatus: user.status,
    reason: "manual_create",
    actor: { id: session.user.id, name: session.user.name },
  });
  await recordDataAccessLog({
    session,
    action: "USER_CREATE",
    summary: `Membuat pengguna ${user.name} (${user.role})`,
    targetType: "User",
    targetId: user.id,
    meta: { role: user.role, email: user.email },
  });
  const { password: _, parentTelegramLinkToken: linkTok, photoData: __, ...safe } = user;
  const bot = getTelegramBotUsername();
  const ortuTelegramLink =
    r === "STUDENT" && bot && linkTok ? buildParentTelegramDeepLink(bot, linkTok) : undefined;
  return NextResponse.json({ ...safe, ortuTelegramLink }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  if (ids.length < 1) return NextResponse.json({ error: "ids wajib diisi" }, { status: 400 });

  if (body.active === undefined) {
    return NextResponse.json({ error: "active wajib diisi" }, { status: 400 });
  }
  const active = Boolean(body.active);
  const nextStatus = statusFromActiveToggle(active);
  const statusFields = lifecycleFieldsForStatus(nextStatus);

  const targets = await prisma.user.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, role: true, status: true, active: true },
  });
  if (targets.some((t) => !canModifyUser(session.user.role, t.role))) {
    return NextResponse.json(
      { error: "Anda tidak boleh mengubah akun dengan level sama atau lebih tinggi." },
      { status: 403 }
    );
  }

  if (!active) {
    const saActiveInBatch = targets.filter((t) => t.role === "SUPER_ADMIN" && t.status === "ACTIVE").length;
    if (saActiveInBatch > 0) {
      const totalActiveSa = await prisma.user.count({
        where: { role: "SUPER_ADMIN", ...ACTIVE_USER_WHERE },
      });
      if (totalActiveSa - saActiveInBatch < 1) {
        return NextResponse.json({ error: LAST_ACTIVE_SA_MSG }, { status: 400 });
      }
    }
  }

  const res = await prisma.user.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: statusFields,
  });

  await Promise.all(
    targets
      .filter((t) => t.status !== nextStatus)
      .map((t) =>
        recordUserLifecycleEvent({
          userId: t.id,
          event: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
          fromStatus: t.status,
          toStatus: nextStatus,
          reason: "bulk_active_toggle",
          actor: { id: session.user.id, name: session.user.name },
        })
      )
  );

  await recordDataAccessLog({
    session,
    action: active ? "USER_BULK_ACTIVATE" : "USER_BULK_DEACTIVATE",
    summary: `${active ? "Aktifkan" : "Blokir"} ${res.count} pengguna`,
    targetType: "User",
    meta: { count: res.count, ids: ids.slice(0, 50) },
  });

  return NextResponse.json({ ok: true, count: res.count });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const classId = typeof body?.classId === "string" && body.classId.trim() ? body.classId.trim() : null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  if (!classId && ids.length < 1) return NextResponse.json({ error: "ids atau classId wajib diisi" }, { status: 400 });

  if (classId) {
    try {
      const count = await softDeleteStudentsByClassId({ classId });
      await recordDataAccessLog({
        session,
        action: "USER_DELETE_BY_CLASS",
        summary: `Soft-delete ${count} siswa di kelas`,
        targetType: "Class",
        targetId: classId,
        meta: { count },
      });
      return NextResponse.json({ ok: true, count, softDeleted: true });
    } catch (e: unknown) {
      console.error("[users DELETE by class]", e);
      return NextResponse.json({ error: "Gagal menghapus siswa di kelas ini." }, { status: 400 });
    }
  }

  const found = await prisma.user.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, role: true, name: true },
  });

  const nonStudents = found.filter((u) => u.role !== "STUDENT");
  if (nonStudents.length > 0) {
    return NextResponse.json(
      { error: `Bulk delete hanya untuk siswa. Tidak bisa hapus: ${nonStudents.map((u) => u.name).join(", ")}` },
      { status: 400 }
    );
  }

  if (found.some((u) => !canDeleteUser(session.user.role, u.role))) {
    return NextResponse.json({ error: "Anda tidak boleh menghapus salah satu akun yang dipilih." }, { status: 403 });
  }

  try {
    const count = await softDeleteUsersByIds({
      ids: found.map((u) => u.id),
    });
    await recordDataAccessLog({
      session,
      action: "USER_BULK_DELETE",
      summary: `Soft-delete ${count} siswa`,
      targetType: "User",
      meta: { count, names: found.slice(0, 20).map((u) => u.name) },
    });
    return NextResponse.json({ ok: true, count, softDeleted: true });
  } catch (e: unknown) {
    console.error("[users DELETE bulk]", e);
    return NextResponse.json({ error: "Gagal menghapus pengguna." }, { status: 400 });
  }
}
