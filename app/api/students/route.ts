import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  buildStudentCreateInput,
  isDefaultStudentPasswordConfigError,
  resolveDefaultStudentPassword,
  resolveStudentEmail,
} from "@/lib/student-upsert";
import { canManageData } from "@/lib/staff-roles";
import { buildParentTelegramDeepLink } from "@/lib/parent-telegram-link";
import { parseUserPhotoInput } from "@/lib/user-photo";
import { validateNewPassword } from "@/lib/password-policy";
import { getTelegramBotUsername } from "@/lib/telegram-bot-username";
import { recordDataAccessLog } from "@/lib/access-log";

function staffOk(role: string | undefined) {
  return canManageData(role);
}

const STUDENT_DOMAIN = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !staffOk(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, nisn, classId, email, password, photoData } = body as {
    name?: string;
    nisn?: string | null;
    classId?: string;
    email?: string | null;
    password?: string | null;
    photoData?: string | null;
  };

  if (!name?.trim() || !classId) {
    return NextResponse.json({ error: "Nama dan kelas wajib diisi" }, { status: 400 });
  }

  const photo = parseUserPhotoInput(photoData);
  if ("error" in photo) return NextResponse.json({ error: photo.error }, { status: 400 });

  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 400 });

  const nisnTrim = nisn?.trim() || "";
  if (nisnTrim) {
    const existingNisn = await prisma.user.findFirst({ where: { nisn: nisnTrim } });
    if (existingNisn) return NextResponse.json({ error: "NISN sudah terdaftar" }, { status: 409 });
  }

  const emailResolved = resolveStudentEmail({
    email,
    nisn: nisnTrim || null,
    domain: STUDENT_DOMAIN,
  });
  if (!emailResolved.ok) {
    return NextResponse.json({ error: emailResolved.error }, { status: 400 });
  }
  const finalEmail = emailResolved.email;

  const existingEmail = await prisma.user.findUnique({ where: { email: finalEmail } });
  if (existingEmail) return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });

  let pwdRaw: string;
  try {
    pwdRaw = (password?.trim() || resolveDefaultStudentPassword()).slice(0, 72);
  } catch (e) {
    if (isDefaultStudentPasswordConfigError(e)) {
      console.error("[students POST]", e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "DEFAULT_STUDENT_PASSWORD belum diatur." },
        { status: 503 }
      );
    }
    throw e;
  }
  const pwdCheck = validateNewPassword(pwdRaw);
  if (!pwdCheck.ok) return NextResponse.json({ error: pwdCheck.error }, { status: 400 });

  const hashed = await bcrypt.hash(pwdCheck.value, 12);
  let data;
  try {
    data = buildStudentCreateInput({
      name,
      nisn: nisnTrim || null,
      classId,
      email: finalEmail,
      hashedPassword: hashed,
      photoData: photo.photoData,
      photoPresent: photo.photoPresent,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Data Telegram ortu tidak valid";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const user = await prisma.user.create({ data, include: { class: true } });
  await recordDataAccessLog({
    session,
    action: "STUDENT_CREATE",
    summary: `Tambah siswa ${user.name}`,
    targetType: "User",
    targetId: user.id,
    meta: { email: user.email, classId: user.classId },
  });
  const { password: _, parentTelegramLinkToken: linkTok, photoData: __, ...safe } = user;
  const bot = getTelegramBotUsername();
  const ortuTelegramLink =
    bot && linkTok ? buildParentTelegramDeepLink(bot, linkTok) : undefined;
  return NextResponse.json({ ...safe, ortuTelegramLink }, { status: 201 });
}
