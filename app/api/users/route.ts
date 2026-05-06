import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { normalizeParentTelegram } from "@/lib/student-upsert";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";

const VALID_ROLES = new Set<string>(Object.values(Role));

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, email, password, role, nisn, nip, classId, active, parentTelegram } = body;
  if (!name || !email || !password) return NextResponse.json({ error: "Nama, email, password wajib" }, { status: 400 });
  if (!role || !VALID_ROLES.has(String(role))) {
    return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 12);
  const r = role as Role;
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: r,
      nisn: nisn || null,
      nip: nip || null,
      classId: r === "STUDENT" || r === "WALI_KELAS" ? classId || null : null,
      parentTelegram: r === "STUDENT" ? normalizeParentTelegram(parentTelegram) ?? null : null,
      parentTelegramLinkToken: r === "STUDENT" ? newParentLinkToken() : null,
      active: active ?? true,
    },
  });
  const { password: _, parentTelegramLinkToken: linkTok, ...safe } = user;
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  const ortuTelegramLink =
    r === "STUDENT" && bot && linkTok ? buildParentTelegramDeepLink(bot, linkTok) : undefined;
  return NextResponse.json({ ...safe, ortuTelegramLink }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string" && x.trim()) : [];
  if (ids.length < 1) return NextResponse.json({ error: "ids wajib diisi" }, { status: 400 });

  if (body.active === undefined) {
    return NextResponse.json({ error: "active wajib diisi" }, { status: 400 });
  }
  const active = Boolean(body.active);

  if (!active) {
    const superCount = await prisma.user.count({
      where: { id: { in: ids }, role: "SUPER_ADMIN" },
    });
    if (superCount > 0) {
      return NextResponse.json(
        { error: "Tidak bisa menonaktifkan akun Super Admin lewat aksi massal." },
        { status: 400 }
      );
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
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
