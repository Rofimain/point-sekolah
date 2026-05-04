import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { normalizeParentTelegram } from "@/lib/student-upsert";

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
      active: active ?? true,
    },
  });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
