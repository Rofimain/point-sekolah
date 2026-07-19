/** Kutipan lurus/lengkung di ujung — sering ikut saat copy-paste dari Word/Docs/Secrets UI. */
function stripWrappingQuotes(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^["'`“”‘’]+/, "")
    .replace(/["'`“”‘’]+$/, "")
    .trim();
}

/** Bersihkan nilai env Telegram yang sering rusak saat copy-paste (kutipan lengkung, BOM, spasi). */
export function sanitizeTelegramBotToken(raw: string | undefined | null): string {
  if (!raw) return "";
  return stripWrappingQuotes(raw);
}

export function sanitizeTelegramWebhookSecret(raw: string | undefined | null): string {
  if (!raw) return "";
  return stripWrappingQuotes(raw);
}

/** Username bot tanpa @ dan tanpa kutipan (contoh rusak: `"alpuspoint_bot"` → link t.me gagal). */
export function sanitizeTelegramBotUsername(raw: string | undefined | null): string {
  if (!raw) return "";
  return stripWrappingQuotes(raw).replace(/^@+/, "");
}

/** Token bot Telegram berbentuk `123456789:AA...` */
export function looksLikeTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);
}
