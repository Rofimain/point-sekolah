import crypto from "crypto";
import { sanitizeTelegramBotUsername } from "@/lib/telegram-env";

/** Payload dalam /start (max ~64 char menurut Telegram). */
export function newParentLinkToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function parentStartPayload(token: string): string {
  return `ortu_${token}`;
}

/** HTTPS deep link; botUsername tanpa @ / tanpa kutipan lengkung */
export function buildParentTelegramDeepLink(botUsername: string, token: string): string {
  const u = sanitizeTelegramBotUsername(botUsername);
  if (!u) return "";
  const start = encodeURIComponent(parentStartPayload(token));
  return `https://t.me/${u}?start=${start}`;
}
