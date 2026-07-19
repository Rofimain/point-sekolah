import { parseManualRemisiReason } from "@/lib/remisi-rules";

/** Di basis data: pengurangan 25% setelah periode tenang (aturan no.1). */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";

const ANCHOR_PREFIX = "|anchor=";

/** Reason dengan anchor tanggal kejadian yang mengawali jendela tenang. */
export function buildQuietMonthReason(anchorYmd: string): string {
  const ymd = anchorYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return QUIET_MONTH_REASON;
  }
  return `${QUIET_MONTH_REASON}${ANCHOR_PREFIX}${ymd}`;
}

export function isQuietMonthReason(reason: string): boolean {
  return reason === QUIET_MONTH_REASON || reason.startsWith(`${QUIET_MONTH_REASON}|`);
}

/** Anchor YYYY-MM-DD, atau `null` untuk reason lama tanpa anchor. */
export function parseQuietMonthAnchor(reason: string): string | null {
  if (!isQuietMonthReason(reason)) return null;
  if (reason === QUIET_MONTH_REASON) return null;
  const idx = reason.indexOf(ANCHOR_PREFIX);
  if (idx < 0) return null;
  const ymd = reason.slice(idx + ANCHOR_PREFIX.length).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** Label tampilan untuk nilai `reason` penyesuaian poin. */
export function formatPointAdjustmentReason(reason: string): string {
  if (isQuietMonthReason(reason)) {
    const anchor = parseQuietMonthAnchor(reason);
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
