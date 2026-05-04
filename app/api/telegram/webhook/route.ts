import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TG = "https://api.telegram.org";

/**
 * Webhook Telegram: saat ortu buka t.me/bot?start=ortu_<token> lalu /start,
 * kita simpan `message.chat.id` ke `parentTelegram` untuk siswa yang token-nya cocok.
 * Set webhook + TELEGRAM_WEBHOOK_SECRET (lihat POST /api/telegram/set-webhook).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const hdr = req.headers.get("x-telegram-bot-api-secret-token");
    if (hdr !== secret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let update: { message?: { text?: string; chat?: { id?: number } } };
  try {
    update = (await req.json()) as typeof update;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text;
  if (typeof text !== "string") {
    return NextResponse.json({ ok: true });
  }

  const m = text.trim().match(/^\/start(?:\s+(\S+))?$/);
  const arg = m?.[1]?.trim();
  if (!arg?.startsWith("ortu_")) {
    return NextResponse.json({ ok: true });
  }

  const linkToken = arg.slice(5);
  const chatId = update.message?.chat?.id;
  if (chatId == null) {
    return NextResponse.json({ ok: true });
  }
  const chatIdStr = String(chatId);

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ ok: true });
  }

  const student = await prisma.user.findFirst({
    where: { role: "STUDENT", parentTelegramLinkToken: linkToken },
  });

  if (!student) {
    await fetch(`${TG}/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdStr,
        text: "Tautan tidak valid atau sudah dipakai. Minta link baru ke pihak sekolah.",
      }),
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id: student.id },
    data: {
      parentTelegram: chatIdStr,
      parentTelegramLinkToken: null,
    },
  });

  await fetch(`${TG}/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatIdStr,
      text: `Terhubung. Notifikasi pelanggaran untuk "${student.name}" akan dikirim ke chat ini.`,
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
