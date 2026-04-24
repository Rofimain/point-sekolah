import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { buildStudentCreateInput, DEFAULT_STUDENT_PASSWORD, studentEmailFromNisn } from "@/lib/student-upsert";

function staffOk(role: string | undefined) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
}

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, nisn, classId, email, password } = body as {
    name?: string;
    nisn?: string;
    classId?: string;
    email?: string | null;
    password?: string | null;
  };

  if (!name?.trim() || !nisn?.trim() || !classId) {
    return NextResponse.json({ error: "Nama, NISN, dan kelas wajib diisi" }, { status: 400 });
  }

  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 400 });

  const nisnTrim = nisn.trim();
  const existingNisn = await prisma.user.findFirst({ where: { nisn: nisnTrim } });
  if (existingNisn) return NextResponse.json({ error: "NISN sudah terdaftar" }, { status: 409 });

  let finalEmail = (email?.trim() || "").toLowerCase();
  if (!finalEmail) {
    try {
      finalEmail = studentEmailFromNisn(nisnTrim, STUDENT_DOMAIN);
    } catch {
      return NextResponse.json({ error: "NISN tidak valid untuk email otomatis" }, { status: 400 });
    }
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existingEmail) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });

  const pwd = (password?.trim() || DEFAULT_STUDENT_PASSWORD).slice(0, 72);
  if (pwd.length < 6) return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });

  const hashed = await bcrypt.hash(pwd, 12);
  const data = buildStudentCreateInput({
    name,
    nisn: nisnTrim,
    classId,
    email: finalEmail,
    hashedPassword: hashed,
  });

  const user = await prisma.user.create({ data, include: { class: true } });
  const { password: _, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
