/** Aturan remisi & reward tetap (tata tertib sekolah). */

/** No.1 — remisi otomatis: 1 bulan tenang → 25% dari skor pelanggaran bruto. */
export const AUTO_REMISI_QUIET_DAYS = 30;
export const AUTO_REMISI_PERCENT = 25;

export const MANUAL_REMISI_TYPE = {
  JUARA_SEKOLAH: "JUARA_SEKOLAH",
  JUARA_KABUPATEN: "JUARA_KABUPATEN",
  JUARA_PROVINSI: "JUARA_PROVINSI",
  JUARA_NASIONAL: "JUARA_NASIONAL",
  PRESTASI_REKOMENDASI: "PRESTASI_REKOMENDASI",
  HAFALAN: "HAFALAN",
  KHOTIB_JUMAT: "KHOTIB_JUMAT",
} as const;

export type ManualRemisiType = (typeof MANUAL_REMISI_TYPE)[keyof typeof MANUAL_REMISI_TYPE];

export type ManualRemisiDef = {
  type: ManualRemisiType;
  /** Label singkat di UI */
  label: string;
  /** Penjelasan aturan */
  description: string;
  /** Persentase tetap; null = diisi admin (rekomendasi) */
  fixedPercent: number | null;
  /** Boleh dikalikan (hafalan per juz/surat) */
  allowMultiplier: boolean;
  kind: "remisi" | "reward";
};

export const MANUAL_REMISI_DEFS: ManualRemisiDef[] = [
  {
    type: MANUAL_REMISI_TYPE.JUARA_SEKOLAH,
    label: "Juara tingkat sekolah — 15%",
    description: "Juara kejuaraan di lingkungan sekolah: remisi 15% dari total skor pelanggaran.",
    fixedPercent: 15,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_KABUPATEN,
    label: "Juara tingkat kabupaten/kota — 25%",
    description: "Juara tingkat wilayah kabupaten/kota: remisi 25% dari total skor pelanggaran.",
    fixedPercent: 25,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_PROVINSI,
    label: "Juara tingkat provinsi — 50%",
    description: "Juara tingkat provinsi: remisi 50% dari total skor pelanggaran.",
    fixedPercent: 50,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_NASIONAL,
    label: "Juara tingkat nasional — 100%",
    description: "Juara tingkat nasional: remisi 100% dari total skor pelanggaran.",
    fixedPercent: 100,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.PRESTASI_REKOMENDASI,
    label: "Prestasi akademik/non-akademik (rekomendasi)",
    description: "Poin remisi sesuai rekomendasi sekolah — persentase diisi admin.",
    fixedPercent: null,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.HAFALAN,
    label: "Hafalan tartil / juz Al-Qur'an — 10% per unit",
    description:
      "Hafal tartil surat pilihan (Al-Mulk, Ar-Rahman, Al-Waqi'ah, Yasin, Al-Kahfi, dll.) atau setiap juz: 10% poin reward per unit.",
    fixedPercent: 10,
    allowMultiplier: true,
    kind: "reward",
  },
  {
    type: MANUAL_REMISI_TYPE.KHOTIB_JUMAT,
    label: "Khotib sholat Jumat — 10%",
    description: "Tampil sebagai khotib sholat Jumat: poin reward 10% dari total skor pelanggaran.",
    fixedPercent: 10,
    allowMultiplier: false,
    kind: "reward",
  },
];

export function getManualRemisiDef(type: string): ManualRemisiDef | undefined {
  return MANUAL_REMISI_DEFS.find((d) => d.type === type);
}

/** Hitung persen efektif (hafalan bisa × multiplier). */
export function resolveManualRemisiPercent(
  type: ManualRemisiType,
  opts?: { customPercent?: number; multiplier?: number }
): { ok: true; percent: number } | { ok: false; error: string } {
  const def = getManualRemisiDef(type);
  if (!def) return { ok: false, error: "Jenis remisi/reward tidak dikenal" };

  if (def.fixedPercent == null) {
    const p = opts?.customPercent;
    if (p == null || !Number.isFinite(p) || p <= 0 || p > 100) {
      return { ok: false, error: "Persentase rekomendasi wajib 1–100" };
    }
    return { ok: true, percent: Math.round(p) };
  }

  const mult = def.allowMultiplier ? Math.max(1, Math.min(20, Math.trunc(opts?.multiplier ?? 1))) : 1;
  const percent = def.fixedPercent * mult;
  if (percent > 100) return { ok: true, percent: 100 };
  return { ok: true, percent };
}

export function buildManualRemisiReason(type: ManualRemisiType, note?: string): string {
  const n = note?.trim();
  return n ? `MANUAL_${type}|${n.slice(0, 200)}` : `MANUAL_${type}`;
}
