/** Aturan remisi & reward sekolah. */

/** Remisi otomatis: 25% dari sisa poin, dibulatkan ke atas. */
export const AUTO_REMISI_PERCENT = 25;

/** Kode reason di DB untuk remisi/reward yang diisi admin (nama + %). */
export const MANUAL_REMISI_REASON_CODE = "MANUAL_CUSTOM";

/**
 * Potongan remisi manual dari poin efektif saat ini (bukan skor pelanggaran yang sama berulang).
 * Hasil dibulatkan, dan tidak melebihi poin yang tersisa.
 */
export function manualRemisiCutFromCurrentPoints(currentPoints: number, percent: number): number {
  if (!Number.isFinite(currentPoints) || currentPoints < 1) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  const deduct = Math.round(currentPoints * (percent / 100));
  return Math.min(Math.max(0, deduct), Math.floor(currentPoints));
}

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

/** Hanya baris remisi/reward yang diinput staf. Remisi otomatis dan baris pembatalannya tidak lolos. */
export function isDeletableManualRemisi(reason: string, reversalOfId?: string | null): boolean {
  if (reversalOfId) return false;
  return reason.startsWith("MANUAL_");
}

/**
 * Poin yang kembali setelah satu penyesuaian dihapus.
 * `removedDelta` negatif untuk remisi (mis. -5). Lantai poin tetap 0.
 */
export function effectivePointsAfterRemovingDelta(
  gross: number,
  adjustmentSum: number,
  removedDelta: number
): { before: number; after: number; restored: number } {
  const before = Math.max(0, gross + adjustmentSum);
  const after = Math.max(0, gross + adjustmentSum - removedDelta);
  return { before, after, restored: after - before };
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
