/** Di basis data: pengurangan 25% setelah periode tenang (aturan no.1). */
export const QUIET_MONTH_REASON = "QUIET_MONTH_REDUCTION";

/** Label tampilan untuk nilai `reason` penyesuaian poin. */
export function formatPointAdjustmentReason(reason: string): string {
  if (reason === QUIET_MONTH_REASON) {
    return "Remisi otomatis periode tenang (25%)";
  }

  const pipe = reason.indexOf("|");
  const code = pipe >= 0 ? reason.slice(0, pipe) : reason;
  const note = pipe >= 0 ? reason.slice(pipe + 1) : "";

  const labels: Record<string, string> = {
    MANUAL_JUARA_SEKOLAH: "Remisi juara tingkat sekolah (15%)",
    MANUAL_JUARA_KABUPATEN: "Remisi juara tingkat kabupaten/kota (25%)",
    MANUAL_JUARA_PROVINSI: "Remisi juara tingkat provinsi (50%)",
    MANUAL_JUARA_NASIONAL: "Remisi juara tingkat nasional (100%)",
    MANUAL_PRESTASI_REKOMENDASI: "Remisi prestasi (rekomendasi sekolah)",
    MANUAL_HAFALAN: "Reward hafalan Al-Qur'an (10%/unit)",
    MANUAL_KHOTIB_JUMAT: "Reward khotib sholat Jumat (10%)",
  };

  const base = labels[code] ?? code;
  return note ? `${base} — ${note}` : base;
}
