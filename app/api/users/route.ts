import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";
import { LAST_ACTIVE_SA_MSG } from "@/lib/super-admin-policy";
import { canManageData, isAdminRole } from "@/lib/staff-roles";
import { parseUserPhotoInput } from "@/lib/user-photo";

const VALID_ROLES = new Set<string>(Object.values(Role));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, email, password, role, nisn, nip, classId, active, photoData } = body;
  if (!name || !email || !password) return NextResponse.json({ error: "Nama, email, password wajib" }, { status: 400 });
  if (!role || !VALID_ROLES.has(String(role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }
  const photo = parseUserPhotoInput(photoData);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 12);
  const r = role as Role;
  if (isAdminRole(session.user.role) && r === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Admin tidak boleh membuat akun Super Admin." }, { status: 403 });
  }
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
      active: active ?? true,
      photoData: photo.photoData,
      photoPresent: photo.photoPresent,
    },
  });
  const { password: _, parentTelegramLinkToken: linkTok, photoData: __, ...safe } = user;
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  const ortuTelegramLink =
    r === "STUDENT" && bot && linkTok ? buildParentTelegramDeepLink(bot, linkTok) : undefined;
  return NextResponse.json({ ...safe, ortuTelegramLink }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  if (ids.length < 1) return NextResponse.json({ error: "ids wajib diisi" }, { status: 400 });

  if (body.active === undefined) {
    return NextResponse.json({ error: "active wajib diisi" }, { status: 400 });
  }
  const active = Boolean(body.active);

  const targets = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { role: true, active: true },
  });
  if (isAdminRole(session.user.role) && targets.some((t) => t.role === "ADMIN" || t.role === "SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Admin tidak boleh mengubah akun Admin atau Super Admin." },
      { status: 403 }
    );
  }

  if (!active) {
    const saActiveInBatch = targets.filter((t) => t.role === "SUPER_ADMIN" && t.active).length;
    if (saActiveInBatch > 0) {
      const totalActiveSa = await prisma.user.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (totalActiveSa - saActiveInBatch < 1) {
        return NextResponse.json({ error: LAST_ACTIVE_SA_MSG }, { status: 400 });
      }
    }
  }

  const res = await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { active },
  });
  return NextResponse.json({ ok: true, count: res.count });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const classId = typeof body?.classId === "string" && body.classId.trim() ? body.classId.trim() : null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  if (!classId && ids.length < 1) return NextResponse.json({ error: "ids atau classId wajib diisi" }, { status: 400 });

  if (classId) {
    const res = await prisma.user.deleteMany({ where: { role: "STUDENT", classId } });
    return NextResponse.json({ ok: true, count: res.count });
  }

  const found = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: true, name: true },
  });

  const nonStudents = found.filter((u) => u.role !== "STUDENT");
  if (nonStudents.length > 0) {
    return NextResponse.json(
      { error: `Bulk delete hanya untuk siswa. Tidak bisa hapus: ${nonStudents.map((u) => u.name).join(", ")}` },
      { status: 400 }
    );
  }

  const res = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true, count: res.count });
}
