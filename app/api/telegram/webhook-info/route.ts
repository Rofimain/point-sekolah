import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const TG = "https://api.telegram.org";

/**
 * Super Admin: baca status webhook dari Telegram (URL terpasang, error terakhir, dll).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN belum diatur" }, { status: 400 });
  }

  const res = await fetch(`${TG}/bot${encodeURIComponent(token)}/getWebhookInfo`);
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data);
}
