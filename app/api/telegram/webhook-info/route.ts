import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { looksLikeTelegramBotToken, sanitizeTelegramBotToken } from "@/lib/telegram-env";

const TG = "https://api.telegram.org";

/**
 * Super Admin: baca status webhook dari Telegram (URL terpasang, error terakhir, dll).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = sanitizeTelegramBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur" }, { status: 400 });
  }
  if (!looksLikeTelegramBotToken(token)) {
    return NextResponse.json(
      {
        error:
          "TELEGRAM_BOT_TOKEN formatnya tidak valid. Harus seperti 123456789:AA... dari BotFather, tanpa kutipan lengkung.",
      },
      { status: 400 }
    );
  }

  const res = await fetch(`${TG}/bot${encodeURIComponent(token)}/getWebhookInfo`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (data.ok === false) {
    return NextResponse.json(
      {
        error:
          typeof data.description === "string"
            ? data.description
            : "getWebhookInfo gagal — biasanya token salah/Unauthorized",
        telegram: data,
      },
      { status: 502 }
    );
  }
  return NextResponse.json(data);
}
