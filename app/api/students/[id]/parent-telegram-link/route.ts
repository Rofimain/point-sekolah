import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import { buildParentTelegramDeepLink, newParentLinkToken } from "@/lib/parent-telegram-link";
import { getTelegramBotUsername } from "@/lib/telegram-bot-username";

/**
 * Staff: buat / perbarui tautan ortu (token baru = tautan lama tidak berlaku).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = getTelegramBotUsername();
  if (!bot) {
    return NextResponse.json(
      { error: "Set TELEGRAM_BOT_USERNAME (username bot tanpa @) di ENV_FILE_CONTENT / .env" },
      { status: 400 }
    );
  }

  const student = await prisma.user.findFirst({
    where: { id, role: "STUDENT" },
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
