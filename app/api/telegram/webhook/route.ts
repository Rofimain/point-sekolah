import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeTelegramBotToken, sanitizeTelegramWebhookSecret } from "@/lib/telegram-env";

const TG = "https://api.telegram.org";

export const dynamic = "force-dynamic";

/** Health check — Telegram selalu POST JSON ke path ini */
export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "Gunakan POST untuk injakan Telegram. Daftarkan URL ini lewat POST /api/telegram/set-webhook",
  });
}

/**
 * Webhook Telegram: saat ortu buka t.me/bot?start=ortu_<token> lalu /start,
 * kita simpan `message.chat.id` ke `parentTelegram` untuk siswa yang token-nya cocok.
 * Set webhook + TELEGRAM_WEBHOOK_SECRET (lihat POST /api/telegram/set-webhook).
 */
export async function POST(req: NextRequest) {
  const secret = sanitizeTelegramWebhookSecret(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (!secret) {
    console.error(
      "[telegram webhook] TELEGRAM_WEBHOOK_SECRET belum diatur — menolak semua request. " +
        "Set secret di environment lalu panggil ulang POST /api/telegram/set-webhook."
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hdr = req.headers.get("x-telegram-bot-api-secret-token");
  if (hdr !== secret) {
    console.warn(
      "[telegram webhook] 403 — header X-Telegram-Bot-Api-Secret-Token tidak cocok TELEGRAM_WEBHOOK_SECRET. " +
        "Setelah mengubah secret di environment, panggil lagi POST /api/telegram/set-webhook (Super Admin)."
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let update: { message?: { text?: string; chat?: { id?: number } } };
  try {
    update = (await req.json()) as typeof update;
  } catch {
    console.warn("[telegram webhook] body JSON tidak valid");
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text;
  if (typeof text !== "string") {
    return NextResponse.json({ ok: true });
  }

  const m = text.trim().match(/^\/start(?:\s+(\S+))?$/i);
  const arg = m?.[1]?.trim();
  const tokenFromStart = arg?.match(/^ortu_(.+)$/i);
  if (!tokenFromStart?.[1]) {
    return NextResponse.json({ ok: true });
  }

  const linkToken = tokenFromStart[1];
  const chatId = update.message?.chat?.id;
  if (chatId == null) {
    return NextResponse.json({ ok: true });
  }
  const chatIdStr = String(chatId);

  const token = sanitizeTelegramBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    console.warn("[telegram webhook] TELEGRAM_BOT_TOKEN kosong");
    return NextResponse.json({ ok: true });
  }

  const student = await prisma.user.findFirst({
    where: { role: "STUDENT", parentTelegramLinkToken: linkToken },
  });

  if (!student) {
    console.warn(
      "[telegram webhook] token tidak cocok data siswa (sudah dipakai / link lama / belum klik Salin tautan). prefix:",
      linkToken.slice(0, 6)
    );
    await fetch(`${TG}/bot${encodeURIComponent(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatIdStr,
        text: "Tautan tidak valid atau sudah dipakai. Minta link baru ke pihak sekolah.",
      }),
    }).catch((e) => console.error("[telegram webhook] gagal kirim pesan token invalid:", e));
    return NextResponse.json({ ok: true });
  }

  try {
    await prisma.user.update({
      where: { id: student.id },
      data: {
        parentTelegram: chatIdStr,
        parentTelegramLinkToken: null,
      },
    });
  } catch (e) {
    console.error("[telegram webhook] gagal simpan ke database:", e);
    return NextResponse.json({ ok: true });
  }

  console.log("[telegram webhook] terhubung:", student.name, "chat", chatIdStr);

  await fetch(`${TG}/bot${encodeURIComponent(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatIdStr,
      text: `Terhubung. Notifikasi pelanggaran untuk "${student.name}" akan dikirim ke chat ini.`,
    }),
  }).catch((e) => console.error("[telegram webhook] gagal kirim pesan sukses:", e));

  return NextResponse.json({ ok: true });
}
