import { sanitizeTelegramBotUsername } from "@/lib/telegram-env";

/** Username bot Telegram (tanpa @). Dari ENV_FILE_CONTENT / .env — bukan NEXT_PUBLIC build-arg. */
export function getTelegramBotUsername(): string {
  return sanitizeTelegramBotUsername(
    process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  );
}
