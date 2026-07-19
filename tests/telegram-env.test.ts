import assert from "node:assert/strict";
import { test } from "node:test";
import {
  looksLikeTelegramBotToken,
  sanitizeTelegramBotToken,
  sanitizeTelegramWebhookSecret,
} from "../lib/telegram-env";

test("sanitizeTelegramBotToken strips curly quotes and whitespace", () => {
  assert.equal(sanitizeTelegramBotToken("  “123456:ABC-DEF”  "), "123456:ABC-DEF");
  assert.equal(sanitizeTelegramBotToken('"123456:ABC-DEF"'), "123456:ABC-DEF");
});

test("looksLikeTelegramBotToken accepts BotFather shape", () => {
  assert.equal(looksLikeTelegramBotToken("123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"), true);
  assert.equal(looksLikeTelegramBotToken("bad"), false);
  assert.equal(looksLikeTelegramBotToken(""), false);
});

test("sanitizeTelegramWebhookSecret strips quotes", () => {
  assert.equal(sanitizeTelegramWebhookSecret("“abc_def-123”"), "abc_def-123");
});
