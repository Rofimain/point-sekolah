import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { buildStudentCreateInput, DEFAULT_STUDENT_PASSWORD, studentEmailFromNisn } from "@/lib/student-upsert";

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

function staffOk(role: string | undefined) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
}

type BulkRow = {
  name: string;
  nisn: string;
  classId?: string;
  className?: string;
  email?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { rows, defaultPassword } = body as { rows: BulkRow[]; defaultPassword?: string };
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris data" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maksimal 500 baris per unggahan" }, { status: 400 });
  }

  const classes = await prisma.class.findMany();
  const pwdDefault = (typeof defaultPassword === "string" && defaultPassword.trim()
    ? defaultPassword.trim()
    : DEFAULT_STUDENT_PASSWORD
  ).slice(0, 72);
  if (pwdDefault.length < 6) {
    return NextResponse.json({ error: "Password default minimal 6 karakter" }, { status: 400 });
  }
  const hashedDefault = await bcrypt.hash(pwdDefault, 12);

  const errors: { row: number; message: string }[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    try {
      const name = r.name?.trim();
      const nisn = r.nisn?.trim();
      if (!name || !nisn) {
        errors.push({ row: rowNum, message: "Nama atau NISN kosong" });
        continue;
      }

      let classId = r.classId?.trim();
      const cn = r.className?.trim();
      if (!classId && cn) {
        const found = classes.find((c) => c.name.toLowerCase() === cn.toLowerCase());
        if (!found) {
          errors.push({ row: rowNum, message: `Kelas "${cn}" tidak ditemukan` });
          continue;
        }
        classId = found.id;
      }
      if (!classId) {
        errors.push({ row: rowNum, message: "Kelas wajib (kolom nama_kelas atau id_kelas)" });
        continue;
      }
      if (!classes.some((c) => c.id === classId)) {
        errors.push({ row: rowNum, message: "ID kelas tidak valid" });
        continue;
      }

      const nisnDup = await prisma.user.findFirst({ where: { nisn } });
      if (nisnDup) {
        errors.push({ row: rowNum, message: "NISN sudah terdaftar" });
        continue;
      }

      let email = r.email?.trim().toLowerCase() || "";
      if (!email) {
        try {
          email = studentEmailFromNisn(nisn, STUDENT_DOMAIN);
        } catch {
          errors.push({ row: rowNum, message: "NISN tidak valid untuk email otomatis" });
          continue;
        }
      }

      const mailDup = await prisma.user.findUnique({ where: { email } });
      if (mailDup) {
        errors.push({ row: rowNum, message: `Email ${email} sudah dipakai` });
        continue;
      }

      const pwdRow = r.password?.trim();
      const pwd = (pwdRow || pwdDefault).slice(0, 72);
      if (pwd.length < 6) {
        errors.push({ row: rowNum, message: "Password minimal 6 karakter" });
        continue;
      }
      const hashed = pwdRow ? await bcrypt.hash(pwd, 12) : hashedDefault;

      await prisma.user.create({
        data: buildStudentCreateInput({
          name,
          nisn,
          classId,
          email,
          hashedPassword: hashed,
        }),
      });
      created++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      errors.push({ row: rowNum, message: msg });
    }
  }

  return NextResponse.json({
    created,
    failed: errors.length,
    errors: errors.slice(0, 50),
    truncatedErrors: errors.length > 50,
  });
}
