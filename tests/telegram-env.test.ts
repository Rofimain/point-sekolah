import assert from "node:assert/strict";
import { test } from "node:test";
import {
  looksLikeTelegramBotToken,
  sanitizeTelegramBotToken,
  sanitizeTelegramBotUsername,
  sanitizeTelegramWebhookSecret,
} from "../lib/telegram-env";
import { buildParentTelegramDeepLink } from "../lib/parent-telegram-link";

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

test("sanitizeTelegramBotUsername strips curly quotes and @", () => {
  assert.equal(sanitizeTelegramBotUsername("“alpuspoint_bot”"), "alpuspoint_bot");
  assert.equal(sanitizeTelegramBotUsername("@alpuspoint_bot"), "alpuspoint_bot");
  assert.equal(sanitizeTelegramBotUsername('  "alpuspoint_bot"  '), "alpuspoint_bot");
});

test("buildParentTelegramDeepLink ignores curly quotes in username", () => {
  const url = buildParentTelegramDeepLink("“alpuspoint_bot”", "331e8072bc2b55a997c034c34edd6267");
  assert.equal(url, "https://t.me/alpuspoint_bot?start=ortu_331e8072bc2b55a997c034c34edd6267");
  assert.ok(!url.includes("“") && !url.includes("”"));
});