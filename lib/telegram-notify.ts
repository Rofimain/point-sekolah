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
  const who =
    p.recordedByStaffName?.trim() ||
    "Siswa (laporan mandiri)";
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
  lines.push("", `<i>${escapeHtml(new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }))}</i>`);
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

/**
 * Ubah @username / id ke chat id numerik bisa dikirim bot (setelah user pernah /start).
 * Untuk DM, Telegram lebih andal pakai angka hasil getChat daripada @username mentah.
 */
async function resolveChatIdForSend(token: string, raw: string): Promise<string> {
  const t = normalizeTelegramRecipient(raw);
  if (!t) return t;
  if (/^-?\d+$/.test(t)) return t;

  const url = `${TG_API}/bot${encodeURIComponent(token)}/getChat?chat_id=${encodeURIComponent(t)}`;
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { id?: number };
    description?: string;
  };
  if (data.ok && data.result?.id != null) {
    return String(data.result.id);
  }
  return t;
}

/**
 * Mengirim pesan ke orang tua lewat Bot Telegram. Isi bisa chat ID angka atau @username
 * (user harus sudah menekan /start pada bot sekolah).
 */
export async function sendParentViolationTelegram(
  chatIdOrUsername: string,
  payload: ParentViolationNotifyPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN tidak diatur" };
  }
  const chatRaw = chatIdOrUsername.trim();
  if (!chatRaw) {
    return { ok: false, error: "Chat Telegram kosong" };
  }

  const chat_id = await resolveChatIdForSend(token, chatRaw);
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
    const err =
      data.description ||
      res.statusText ||
      "Gagal kirim Telegram (pastikan ortu sudah /start ke bot, atau pakai chat ID angka dari getUpdates)";
    return { ok: false, error: err };
  }
  return { ok: true };
}

export function scheduleParentViolationTelegram(
  chatIdOrUsername: string | null | undefined,
  payload: ParentViolationNotifyPayload
): void {
  const chat = chatIdOrUsername?.trim();
  if (!chat) return;
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return;

  void sendParentViolationTelegram(chat, payload).then((r) => {
    if (!r.ok) console.error("[telegram] notify parent failed:", r.error);
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram] notify parent failed:", msg);
  });
}
