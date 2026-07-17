/** Aturan remisi & reward sekolah. */

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
  /** Jenis & persen diisi admin. */
  CUSTOM: "CUSTOM",
} as const;

export type ManualRemisiType = (typeof MANUAL_REMISI_TYPE)[keyof typeof MANUAL_REMISI_TYPE];

export type ManualRemisiDef = {
  type: ManualRemisiType;
  /** Label singkat di UI */
  label: string;
  /** Penjelasan aturan */
  description: string;
  /** Persentase tetap; null = diisi admin */
  fixedPercent: number | null;
  /** Boleh dikalikan (hafalan per juz/surat) */
  allowMultiplier: boolean;
  kind: "remisi" | "reward";
  /** Wajib isi nama jenis (CUSTOM). */
  requireCustomLabel?: boolean;
};

export const MANUAL_REMISI_DEFS: ManualRemisiDef[] = [
  {
    type: MANUAL_REMISI_TYPE.JUARA_SEKOLAH,
    label: "Juara tingkat sekolah — 15%",
    description: "Juara kejuaraan di lingkungan sekolah: remisi 15% dari skor pelanggaran sampai tanggal prestasi.",
    fixedPercent: 15,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_KABUPATEN,
    label: "Juara tingkat kabupaten/kota — 25%",
    description: "Juara tingkat wilayah kabupaten/kota: remisi 25% dari skor pelanggaran sampai tanggal prestasi.",
    fixedPercent: 25,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_PROVINSI,
    label: "Juara tingkat provinsi — 50%",
    description: "Juara tingkat provinsi: remisi 50% dari skor pelanggaran sampai tanggal prestasi.",
    fixedPercent: 50,
    allowMultiplier: false,
    kind: "remisi",
  },
  {
    type: MANUAL_REMISI_TYPE.JUARA_NASIONAL,
    label: "Juara tingkat nasional — 100%",
    description: "Juara tingkat nasional: remisi 100% dari skor pelanggaran sampai tanggal prestasi.",
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
    description: "Tampil sebagai khotib sholat Jumat: poin reward 10% dari skor pelanggaran sampai tanggal prestasi.",
    fixedPercent: 10,
    allowMultiplier: false,
    kind: "reward",
  },
  {
    type: MANUAL_REMISI_TYPE.CUSTOM,
    label: "Lainnya — isi manual (nama + %)",
    description:
      "Jenis remisi/reward kustom: isi nama dan persentase pengurangan. Dihitung dari skor pelanggaran sampai tanggal prestasi (hari berikutnya tidak ikut).",
    fixedPercent: null,
    allowMultiplier: false,
    kind: "remisi",
    requireCustomLabel: true,
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
      return { ok: false, error: "Persentase wajib 1–100" };
    }
    return { ok: true, percent: Math.round(p) };
  }

  const mult = def.allowMultiplier ? Math.max(1, Math.min(20, Math.trunc(opts?.multiplier ?? 1))) : 1;
  const percent = def.fixedPercent * mult;
  if (percent > 100) return { ok: true, percent: 100 };
  return { ok: true, percent };
}

export type ManualRemisiReasonParts = {
  code: string;
  customLabel?: string;
  achievementYmd?: string;
  note?: string;
};

/**
 * Format reason di DB:
 * - preset: `MANUAL_TYPE|asOf:YYYY-MM-DD|catatan`
 * - custom: `MANUAL_CUSTOM|asOf:YYYY-MM-DD|Label jenis|catatan`
 */
export function buildManualRemisiReason(
  type: ManualRemisiType,
  opts?: { note?: string; customLabel?: string; achievementYmd?: string }
): string {
  const asOf = opts?.achievementYmd?.trim();
  const note = opts?.note?.trim().slice(0, 200);
  const label = opts?.customLabel?.trim().slice(0, 120);

  const parts: string[] = [`MANUAL_${type}`];
  if (asOf) parts.push(`asOf:${asOf}`);
  if (type === MANUAL_REMISI_TYPE.CUSTOM && label) parts.push(label);
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
    if (code === "MANUAL_CUSTOM" && !customLabel) {
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
