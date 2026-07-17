import { parseManualRemisiReason } from "@/lib/remisi-rules";

/** Di basis data: pengurangan 25% setelah periode tenang (aturan no.1). */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";

/** Label tampilan untuk nilai `reason` penyesuaian poin. */
export function formatPointAdjustmentReason(reason: string): string {
  if (reason === QUIET_MONTH_REASON) {
    return "Remisi otomatis periode tenang (25%)";
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
