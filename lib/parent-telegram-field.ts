/**
 * Nilai yang boleh disimpan untuk notifikasi Telegram ortu (Bot API):
 * kosong, atau chat ID numerik saja. @username tidak didukung untuk DM dari server.
 */
export function parseParentTelegramForDb(
  raw: string | null | undefined
): { ok: true; value: string | null } | { ok: false; error: string } {
  const t = raw?.trim();
  if (!t) return { ok: true, value: null };
  const s = t.replace(/\s/g, "");
  if (/^@/.test(s) || /[a-zA-Z_]/.test(s)) {
    return {
      ok: false,
      error:
        "Telegram ortu: jangan simpan @username atau nama akun. Kosongkan field ini, lalu pakai \"Salin tautan Telegram ortu\" dan minta ortu buka link lalu ketuk Start. Setelah itu chat ID terisi otomatis.",
    };
  }
  if (!/^\d{5,}$/.test(s)) {
    return {
      ok: false,
      error:
        "Telegram ortu: isi hanya Chat ID angka (biasanya 9–12 digit), tanpa huruf/spasi. Atau kosongkan dan pakai tautan ortu.",
    };
  }
  return { ok: true, value: s };
}
