import { prisma } from "@/lib/prisma";
export { APP_KEYS } from "@/lib/app-setting-keys";
import { APP_KEYS } from "@/lib/app-setting-keys";

const DEFAULTS: Record<string, string> = {
  [APP_KEYS.COORD_NAME]: "",
  [APP_KEYS.COORD_TITLE]: "Koordinator BP/BK",
  [APP_KEYS.REDAKSI_PRINT]:
    "Dengan ini menyatakan bahwa data poin pelanggaran di bawah merupakan catatan resmi sekolah sesuai tata tertib yang berlaku. Dokumen ini dapat digunakan untuk arsip orang tua/wali dan tindak lanjut pembinaan.",
  [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: "",
  [APP_KEYS.NEXT_REVIEW_ROSTER]: "",
  [APP_KEYS.SP1_POINTS]: "",
  [APP_KEYS.SP2_POINTS]: "",
  [APP_KEYS.SP3_POINTS]: "",
  [APP_KEYS.SKORSING_POINTS]: "",
  [APP_KEYS.REMISI_QUIET_DAYS]: "",
  [APP_KEYS.REMISI_PERCENT]: "",
};

export async function getAppSetting(key: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value != null && row.value !== "") return row.value;
  return DEFAULTS[key] ?? "";
}

/** Baca banyak key sekali query (lebih hemat untuk halaman settings). */
export async function getAppSettingsMap(keys: readonly string[]): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...keys] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = byKey.get(key);
    out[key] = value != null && value !== "" ? value : (DEFAULTS[key] ?? "");
  }
  return out;
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

export async function getPointThresholds(): Promise<{
  sp1: number | null;
  sp2: number | null;
  sp3: number | null;
  skorsing: number | null;
}> {
  const map = await getAppSettingsMap([
    APP_KEYS.SP1_POINTS,
    APP_KEYS.SP2_POINTS,
    APP_KEYS.SP3_POINTS,
    APP_KEYS.SKORSING_POINTS,
  ]);
  return {
    sp1: parseOptionalInt(map[APP_KEYS.SP1_POINTS]),
    sp2: parseOptionalInt(map[APP_KEYS.SP2_POINTS]),
    sp3: parseOptionalInt(map[APP_KEYS.SP3_POINTS]),
    skorsing: parseOptionalInt(map[APP_KEYS.SKORSING_POINTS]),
  };
}

/** Fallback sync dari env saja — prefer getQuietPeriodDays() untuk nilai DB. */
export function quietPeriodDaysFromEnv(): number {
  const n = parseInt(process.env.POINT_REDUCTION_QUIET_DAYS || "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export async function getQuietPeriodDays(): Promise<number> {
  const fromDb = parseOptionalInt(await getAppSetting(APP_KEYS.REMISI_QUIET_DAYS));
  if (fromDb != null && fromDb > 0) return fromDb;
  return quietPeriodDaysFromEnv();
}

export async function getRemisiPercent(): Promise<number> {
  const fromDb = parseOptionalInt(await getAppSetting(APP_KEYS.REMISI_PERCENT));
  if (fromDb != null && fromDb > 0 && fromDb <= 100) return fromDb;
  return 25;
}

export async function getPrintBlock(): Promise<{
  coordinatorName: string;
  coordinatorTitle: string;
  redaksi: string;
}> {
  const map = await getAppSettingsMap([APP_KEYS.COORD_NAME, APP_KEYS.COORD_TITLE, APP_KEYS.REDAKSI_PRINT]);
  return {
    coordinatorName: map[APP_KEYS.COORD_NAME] || "_______________________",
    coordinatorTitle: map[APP_KEYS.COORD_TITLE] || "Koordinator BP/BK",
    redaksi: map[APP_KEYS.REDAKSI_PRINT] || DEFAULTS[APP_KEYS.REDAKSI_PRINT],
  };
}
