import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isTelegramWebhookSecretValid, TELEGRAM_WEBHOOK_SECRET_HINT } from "@/lib/telegram-webhook-secret";

const TG = "https://api.telegram.org";

/**
 * Super Admin: mendaftarkan URL webhook ke Telegram (wajib HTTPS, cocok untuk Vercel).
 * Body opsional: { "baseUrl": "https://domain.com" } bila env publik belum benar.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur" }, { status: 400 });
  }

  let base =
    (await req.json().catch(() => ({})) as { baseUrl?: string }).baseUrl?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (base && !base.startsWith("http")) {
    base = `https://${base}`;
  }
  if (!base) {
    return NextResponse.json(
      { error: "Tidak ada URL publik. Set NEXTAUTH_URL atau kirim { \"baseUrl\": \"https://...\" }." },
      { status: 400 }
    );
  }

  const webhookUrl = `${base.replace(/\/$/, "")}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (secret && !isTelegramWebhookSecretValid(secret)) {
    return NextResponse.json(
      {
        error: `TELEGRAM_WEBHOOK_SECRET tidak valid untuk Telegram. ${TELEGRAM_WEBHOOK_SECRET_HINT}`,
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

  const res = await fetch(`${TG}/bot${encodeURIComponent(token)}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };

  if (!data.ok) {
    return NextResponse.json(
      { error: data.description || "setWebhook gagal", webhookUrl },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    webhookUrl,
    hint: secret ? "Header secret aktif" : "Set TELEGRAM_WEBHOOK_SECRET lalu panggil lagi untuk keamanan.",
  });
}
