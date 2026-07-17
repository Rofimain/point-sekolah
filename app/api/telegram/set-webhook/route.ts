import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { isTelegramWebhookSecretValid, TELEGRAM_WEBHOOK_SECRET_HINT } from "@/lib/telegram-webhook-secret";
import {
  looksLikeTelegramBotToken,
  sanitizeTelegramBotToken,
  sanitizeTelegramWebhookSecret,
} from "@/lib/telegram-env";

const TG = "https://api.telegram.org";

/**
 * Admin: mendaftarkan URL webhook Telegram hanya ke domain NEXTAUTH_URL.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = sanitizeTelegramBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    return NextResponse.json(
      {
        error:
          "TELEGRAM_BOT_TOKEN belum diatur di ENV_FILE_CONTENT (secret server). Simpan secret, pastikan deploy sudah jalan, lalu coba lagi.",
      },
      { status: 400 }
    );
  }
  if (!looksLikeTelegramBotToken(token)) {
    return NextResponse.json(
      {
        error:
          "TELEGRAM_BOT_TOKEN formatnya tidak valid. Harus seperti 123456789:AA... dari BotFather — tanpa spasi/kutipan lengkung. Cek ENV_FILE_CONTENT.",
      },
      { status: 400 }
    );
  }

  const base = process.env.NEXTAUTH_URL?.trim();
  if (!base) {
    return NextResponse.json({ error: "NEXTAUTH_URL belum diatur." }, { status: 400 });
  }

  let configuredUrl: URL;
  try {
    configuredUrl = new URL(base);
  } catch {
    return NextResponse.json({ error: "NEXTAUTH_URL tidak valid." }, { status: 400 });
  }
  if (configuredUrl.protocol !== "https:") {
    return NextResponse.json({ error: "NEXTAUTH_URL untuk webhook wajib HTTPS." }, { status: 400 });
  }
  const webhookUrl = new URL("/api/telegram/webhook", configuredUrl).toString();
  const secret = sanitizeTelegramWebhookSecret(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (secret && !isTelegramWebhookSecretValid(secret)) {
    return NextResponse.json(
      {
        error: `TELEGRAM_WEBHOOK_SECRET tidak valid untuk Telegram. ${TELEGRAM_WEBHOOK_SECRET_HINT}`,
        webhookUrl,
      },
      { status: 400 }
    );
  }

  const body: Record<string, unknown> = {
    url: webhookUrl,
    allowed_updates: ["message"],
  };
  if (secret) {
    body.secret_token = secret;
  }

  let res: Response;
  try {
    res = await fetch(`${TG}/bot${encodeURIComponent(token)}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `Gagal menghubungi api.telegram.org: ${e instanceof Error ? e.message : "network error"}`,
        webhookUrl,
      },
      { status: 502 }
    );
  }

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    error_code?: number;
  };

  if (!data.ok) {
    const desc = data.description?.trim() || "";
    let error = desc || `setWebhook gagal (HTTP ${res.status})`;
    if (data.error_code === 401 || /unauthorized/i.test(desc) || res.status === 401) {
      error =
        "Token bot ditolak Telegram (Unauthorized). Cek TELEGRAM_BOT_TOKEN di ENV_FILE_CONTENT — pastikan sama persis dari BotFather, tanpa kutipan lengkung “ ”.";
    } else if (/ssl|certificate|handshake/i.test(desc)) {
      error = `${desc} — sertifikat HTTPS domain harus valid untuk ${configuredUrl.host} (Cloudflare SSL Full / Full Strict).`;
    } else if (/resolve host|getaddrinfo|timed out|timeout/i.test(desc)) {
      error = `${desc} — pastikan domain ${configuredUrl.host} bisa diakses publik dari internet.`;
    } else if (desc) {
      error = desc;
    }

    return NextResponse.json(
      {
        error,
        webhookUrl,
        telegram: {
          ok: data.ok ?? false,
          error_code: data.error_code ?? null,
          description: desc || null,
          httpStatus: res.status,
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    hint: secret ? "Header secret aktif" : "Set TELEGRAM_WEBHOOK_SECRET lalu panggil lagi untuk keamanan.",
  });
}
