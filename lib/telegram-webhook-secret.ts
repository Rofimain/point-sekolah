/** Telegram setWebhook: secret_token hanya A–Z a–z 0–9 _ - panjang 1–256 (lihat Bot API). */
const TG_WEBHOOK_SECRET_RE = /^[A-Za-z0-9_-]{1,256}$/;

export function isTelegramWebhookSecretValid(raw: string): boolean {
  return TG_WEBHOOK_SECRET_RE.test(raw.trim());
}

export const TELEGRAM_WEBHOOK_SECRET_HINT =
  "Hanya huruf (A–Z, a–z), angka, underscore (_), dan tanda hubung (-); panjang 1–256. " +
  "Jangan pakai spasi, titik dua, atau base64 mentah (+ / =). Contoh: openssl rand -hex 32";
