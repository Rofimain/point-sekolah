import { parseParentTelegramForDb } from "@/lib/parent-telegram-field";
import { sanitizeTelegramBotToken } from "@/lib/telegram-env";

const TG_API = "https://api.telegram.org";

export type ParentViolationNotifyPayload = {
  studentName: string;
  violationName: string;
  points: number;
  sessionSlot?: string | null;
  notes?: string | null;
  /** Nama staff yang mencatat; kosong jika siswa melapor sendiri */
  recordedByStaffName?: string | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildMessage(p: ParentViolationNotifyPayload): string {
  const who = p.recordedByStaffName?.trim() || "Siswa (laporan mandiri)";
  const lines = [
    "<b>Notifikasi pelanggaran</b>",
    "",
    `<b>Siswa:</b> ${escapeHtml(p.studentName)}`,
    `<b>Jenis:</b> ${escapeHtml(p.violationName)}`,
    `<b>Poin:</b> ${p.points}`,
    `<b>Dicatat oleh:</b> ${escapeHtml(who)}`,
  ];
  if (p.sessionSlot?.trim()) lines.push(`<b>Sesi:</b> ${escapeHtml(p.sessionSlot.trim())}`);
  if (p.notes?.trim()) lines.push(`<b>Catatan:</b> ${escapeHtml(p.notes.trim())}`);
  lines.push(
    "",
    `<i>${escapeHtml(new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }))}</i>`
  );
  return lines.join("\n");
}

/** Normalisasi: chat ID angka atau @username (tanpa spasi). */
export function normalizeTelegramRecipient(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (!s.startsWith("@") && !/^-?\d+$/.test(s)) {
    s = `@${s}`;
  }
  return s;
}

/** DM bot → pengguna: harus chat ID numerik (validasi sama dengan penyimpanan di DB). */
function parseDmChatId(raw: string): { ok: true; chatId: string } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) {
    return { ok: false, error: "Chat Telegram kosong" };
  }
  const p = parseParentTelegramForDb(s);
  if (!p.ok) return p;
  if (!p.value) return { ok: false, error: "Chat Telegram kosong" };
  return { ok: true, chatId: p.value };
}

/**
 * Mengirim pesan ke orang tua. Field `parentTelegram` di DB harus **chat ID angka**
 * (hasil tautan ortu via webhook, atau salin dari getUpdates untuk **bot yang sama**).
 */
export async function sendParentViolationTelegram(
  chatIdOrUsername: string,
  payload: ParentViolationNotifyPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = sanitizeTelegramBotToken(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN tidak diatur" };
  }

  const parsed = parseDmChatId(chatIdOrUsername);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const chat_id = parsed.chatId;
  const text = buildMessage(payload);
  const url = `${TG_API}/bot${encodeURIComponent(token)}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || data.ok === false) {
    const raw = data.description || res.statusText || "";
    return { ok: false, error: humanizeTelegramSendError(raw, true) };
  }
  return { ok: true };
}

/** Pesan API Telegram → bahasa yang bisa langsung dipahami orang sekolah */
export function humanizeTelegramSendError(apiDescription: string, usedNumericChatId = false): string {
  const d = (apiDescription || "").toLowerCase();
  if (d.includes("chat not found")) {
    if (usedNumericChatId) {
      return (
        "Chat tidak ditemukan (meski pakai angka). Penyebab umum: (1) ortu belum pernah Start ke **bot yang sama** dengan TELEGRAM_BOT_TOKEN di environment, " +
        "(2) Chat ID diambil dari bot lain / dari @userinfobot — harus dari obrolan dengan bot sekolah, " +
        "(3) salah menyalin angka. Solusi: hapus angka di data siswa, pakai tautan ortu (ortu buka link → Start), atau ambil ID dari getUpdates **token bot ini** setelah ortu Start."
      );
    }
    return (
      "Chat tidak ditemukan. Untuk chat pribadi, Telegram sering menolak kirim ke @username — " +
      "pakai tautan resmi sekolah (t.me/bot?start=ortu_...) supaya ortu cukup Start, atau isi chat ID angka. " +
      "Pastikan ortu sudah menekan Start ke bot yang token-nya dipakai aplikasi."
    );
  }
  if (d.includes("blocked") || d.includes("blocked by user")) {
    return "Pengguna memblokir bot ini — buka Telegram → unblock bot sekolah → kirim /start lagi.";
  }
  if (d.includes("bot can't initiate")) {
    return "Bot tidak boleh memulai chat. Penerima harus /start dulu ke bot sekolah.";
  }
  if (d.includes("forbidden")) {
    return `Telegram menolak: ${apiDescription || "akses ditolak"}. Pastikan penerima sudah /start ke bot.`;
  }
  return apiDescription || "Gagal kirim ke Telegram; cek token bot & tujuan (ortu wajib /start).";
}
