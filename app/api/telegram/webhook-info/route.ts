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
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: {
      url?: string;
      pending_update_count?: number;
      has_custom_certificate?: boolean;
      last_error_message?: string;
      last_error_date?: number;
    };
  };
  if (data.ok === false) {
    console.error("[telegram webhook-info] gagal:", data.description);
    return NextResponse.json({ error: "Gagal membaca status webhook." }, { status: 502 });
  }

  const result = data.result ?? {};
  if (result.last_error_message) {
    console.warn("[telegram webhook-info] last_error:", result.last_error_message);
  }

  return NextResponse.json({
    ok: true,
    result: {
      url: result.url ?? "",
      pending_update_count: result.pending_update_count ?? 0,
      has_custom_certificate: Boolean(result.has_custom_certificate),
      has_last_error: Boolean(result.last_error_message),
    },
  });
}
