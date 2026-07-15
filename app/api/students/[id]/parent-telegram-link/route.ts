import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";

/**
 * Staff: buat / perbarui tautan ortu (token baru = tautan lama tidak berlaku).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!bot) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (username bot tanpa @) di environment" },
      { status: 400 }
    );
  }

  const student = await prisma.user.findFirst({
    where: { id: params.id, role: "STUDENT" },
  });
  if (!student) {
    return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
  }

  const token = newParentLinkToken();
  await prisma.user.update({
    where: { id: student.id },
    data: { parentTelegramLinkToken: token },
  });

  const url = buildParentTelegramDeepLink(bot, token);
  return NextResponse.json({ url, ortuTelegramLink: url });
}
