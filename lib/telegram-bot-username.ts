/** Username bot Telegram (tanpa @). Dari ENV_FILE_CONTENT / .env — bukan NEXT_PUBLIC build-arg. */
export function getTelegramBotUsername(): string {
  const raw = process.env.TELEGRAM_BOT_USERNAME?.trim() || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || "";
  return raw.replace(/^@/, "");
}
