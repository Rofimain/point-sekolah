import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const { name, email, password, role, nisn, nip, classId, active } = body;
  if (!name || !email || !password) return NextResponse.json({ error: "Nama, email, password wajib" }, { status: 400 });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, password: hashed, role, nisn: nisn || null, nip: nip || null, classId: classId || null, active: active ?? true } });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
