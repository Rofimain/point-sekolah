/** Bersihkan nilai env Telegram yang sering rusak saat copy-paste (kutipan lengkung, BOM, spasi). */
export function sanitizeTelegramBotToken(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^\uFEFF/, "")
    // kutipan lurus & lengkung di ujung
    .replace(/^["'`“”‘’]+/, "")
    .replace(/["'`“”‘’]+$/, "")
    .trim();
}

export function sanitizeTelegramWebhookSecret(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["'`“”‘’]+/, "")
    .replace(/["'`“”‘’]+$/, "")
    .trim();
}

/** Token bot Telegram berbentuk `123456789:AA...` */
export function looksLikeTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}
