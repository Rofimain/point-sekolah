import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { isTelegramWebhookSecretValid, TELEGRAM_WEBHOOK_SECRET_HINT } from "@/lib/telegram-webhook-secret";

const TG = "https://api.telegram.org";

/**
 * Admin: mendaftarkan URL webhook Telegram hanya ke domain NEXTAUTH_URL.
 */
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageData(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur" }, { status: 400 });
  }

  const base = process.env.NEXTAUTH_URL?.trim();
  if (!base) {
    return NextResponse.json(
      { error: "NEXTAUTH_URL belum diatur." },
      { status: 400 }
    );
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
