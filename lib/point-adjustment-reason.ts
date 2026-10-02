import { parseManualRemisiReason } from "@/lib/remisi-rules";

/** Di basis data: pengurangan 25% remisi otomatis berantai. */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";
export const QUIET_MONTH_REVERSAL = "QUIET_MONTH_REVERSAL";

const ANCHOR_PREFIX = "|anchor=";

const ID_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** YYYY-MM-DD → "19 Agustus 2026". */
export function formatYmdIndonesia(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const month = ID_MONTHS[Number(m[2]) - 1];
  if (!month) return ymd;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/** Reason otomatis. Tanpa step = format lama (kompatibel). */
export function buildQuietMonthReason(anchorYmd: string, step?: number): string {
  const ymd = anchorYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return QUIET_MONTH_REASON;
  const base = `${QUIET_MONTH_REASON}${ANCHOR_PREFIX}${ymd}`;
  if (step != null && Number.isFinite(step) && step >= 1) return `${base}|step=${Math.floor(step)}`;
  return base;
}

export function buildQuietMonthReversalReason(anchorYmd: string, step: number, sebab: string): string {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(anchorYmd.trim()) ? anchorYmd.trim() : "";
  const clean = sebab.replace(/\|/g, " ").trim().slice(0, 180);
  return `${QUIET_MONTH_REVERSAL}|anchor=${ymd}|step=${Math.floor(step)}|sebab=${clean}`;
}

export function isQuietMonthReason(reason: string): boolean {
  return reason === QUIET_MONTH_REASON || reason.startsWith(`${QUIET_MONTH_REASON}|`);
}

export function isQuietMonthReversalReason(reason: string): boolean {
  return reason === QUIET_MONTH_REVERSAL || reason.startsWith(`${QUIET_MONTH_REVERSAL}|`);
}

/** Anchor YYYY-MM-DD, atau `null` untuk reason lama tanpa anchor. */
export function parseQuietMonthAnchor(reason: string): string | null {
  if (!isQuietMonthReason(reason)) return null;
  if (reason === QUIET_MONTH_REASON) return null;
  const idx = reason.indexOf(ANCHOR_PREFIX);
  if (idx < 0) return null;
  const ymd = reason.slice(idx + ANCHOR_PREFIX.length, idx + ANCHOR_PREFIX.length + 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function parseQuietMonthReason(reason: string): { anchor: string | null; step: number | null } {
  if (!isQuietMonthReason(reason)) return { anchor: null, step: null };
  const anchor = parseQuietMonthAnchor(reason);
  const stepMatch = /(?:^|\|)step=(\d+)/.exec(reason);
  const step = stepMatch ? Number(stepMatch[1]) : null;
  return { anchor, step: step != null && step >= 1 ? step : null };
}

export function parseQuietMonthReversalReason(reason: string): {
  anchor: string | null;
  step: number | null;
  sebab: string | null;
} {
  if (!isQuietMonthReversalReason(reason)) return { anchor: null, step: null, sebab: null };
  let anchor: string | null = null;
  let step: number | null = null;
  let sebab: string | null = null;
  for (const part of reason.split("|").slice(1)) {
    if (part.startsWith("anchor=") && /^\d{4}-\d{2}-\d{2}$/.test(part.slice(7))) anchor = part.slice(7);
    else if (part.startsWith("step=")) {
      const n = Number(part.slice(5));
      if (Number.isFinite(n) && n >= 1) step = n;
    } else if (part.startsWith("sebab=")) sebab = part.slice(6);
  }
  return { anchor, step, sebab };
}

/** Label tampilan untuk nilai `reason` penyesuaian poin. */
export function formatPointAdjustmentReason(reason: string): string {
  if (isQuietMonthReversalReason(reason)) {
    const rev = parseQuietMonthReversalReason(reason);
    const tahap = rev.step != null ? String(rev.step) : "—";
    return rev.sebab ? `Pembatalan remisi tahap ${tahap} — ${rev.sebab}` : `Pembatalan remisi tahap ${tahap}`;
  }

  if (isQuietMonthReason(reason)) {
    const { anchor, step } = parseQuietMonthReason(reason);
    if (step != null) {
      const base = `Remisi otomatis tahap ${step} (25% dari sisa poin)`;
      return anchor ? `${base} — bersih sejak ${formatYmdIndonesia(anchor)}` : base;
    }
    const base = "Remisi otomatis periode tenang (25%)";
    return anchor ? `${base} — sejak ${anchor}` : base;
  }

  const parsed = parseManualRemisiReason(reason);
  const labels: Record<string, string> = {
    MANUAL_JUARA_SEKOLAH: "Remisi juara tingkat sekolah (15%)",
    MANUAL_JUARA_KABUPATEN: "Remisi juara tingkat kabupaten/kota (25%)",
    MANUAL_JUARA_PROVINSI: "Remisi juara tingkat provinsi (50%)",
    MANUAL_JUARA_NASIONAL: "Remisi juara tingkat nasional (100%)",
    MANUAL_PRESTASI_REKOMENDASI: "Remisi prestasi (rekomendasi sekolah)",
    MANUAL_HAFALAN: "Reward hafalan Al-Qur'an (10%/unit)",
    MANUAL_KHOTIB_JUMAT: "Reward khotib sholat Jumat (10%)",
    MANUAL_CUSTOM: "Remisi/reward manual",
  };

  let base = labels[parsed.code] ?? parsed.code;
  if (parsed.code === "MANUAL_CUSTOM" && parsed.customLabel) {
    base = `Remisi/reward: ${parsed.customLabel}`;
  }

  const bits: string[] = [base];
  if (parsed.achievementYmd) bits.push(`prestasi ${parsed.achievementYmd}`);
  if (parsed.note) bits.push(parsed.note);
  return bits.join(" — ");
}
