/** Aturan remisi & reward sekolah. */

/** Remisi otomatis: 1 bulan tenang → 25% dari skor pelanggaran bruto. */
export const AUTO_REMISI_QUIET_DAYS = 30;
export const AUTO_REMISI_PERCENT = 25;

/** Kode reason di DB untuk remisi/reward yang diisi admin (nama + %). */
export const MANUAL_REMISI_REASON_CODE = "MANUAL_CUSTOM";

export function resolveManualRemisiPercent(
  customPercent: unknown
): { ok: true; percent: number } | { ok: false; error: string } {
  const p = typeof customPercent === "number" ? customPercent : Number(customPercent);
  if (!Number.isFinite(p) || p <= 0 || p > 100) {
    return { ok: false, error: "Persentase wajib 1–100" };
  }
  return { ok: true, percent: Math.round(p) };
}

export type ManualRemisiReasonParts = {
  code: string;
  customLabel?: string;
  achievementYmd?: string;
  note?: string;
};

/**
 * Format reason di DB:
 * `MANUAL_CUSTOM|asOf:YYYY-MM-DD|Label jenis|catatan`
 */
export function buildManualRemisiReason(opts: {
  customLabel: string;
  achievementYmd?: string;
  note?: string;
}): string {
  const asOf = opts.achievementYmd?.trim();
  const note = opts.note?.trim().slice(0, 200);
  const label = opts.customLabel.trim().slice(0, 120);

  const parts: string[] = [MANUAL_REMISI_REASON_CODE];
  if (asOf) parts.push(`asOf:${asOf}`);
  if (label) parts.push(label);
  if (note) parts.push(note);
  return parts.join("|");
}

export function parseManualRemisiReason(reason: string): ManualRemisiReasonParts {
  const chunks = reason.split("|");
  const code = chunks[0] || reason;
  let achievementYmd: string | undefined;
  let customLabel: string | undefined;
  const notes: string[] = [];

  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i];
    if (c.startsWith("asOf:") && /^\d{4}-\d{2}-\d{2}$/.test(c.slice(5))) {
      achievementYmd = c.slice(5);
      continue;
    }
    if (code === MANUAL_REMISI_REASON_CODE && !customLabel) {
      customLabel = c;
      continue;
    }
    notes.push(c);
  }

  return {
    code,
    customLabel,
    achievementYmd,
    note: notes.length ? notes.join("|") : undefined,
  };
}
