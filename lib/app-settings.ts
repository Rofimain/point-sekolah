import { prisma } from "@/lib/prisma";
export { APP_KEYS } from "@/lib/app-setting-keys";
import { APP_KEYS } from "@/lib/app-setting-keys";

const DEFAULTS: Record<string, string> = {
  [APP_KEYS.REDAKSI_PRINT]:
    "Dengan ini menyatakan bahwa data poin pelanggaran di bawah merupakan catatan resmi sekolah sesuai tata tertib yang berlaku. Dokumen ini dapat digunakan untuk arsip orang tua/wali dan tindak lanjut pembinaan.",
  [APP_KEYS.SP1_POINTS]: "",
  [APP_KEYS.SP2_POINTS]: "",
  [APP_KEYS.SP3_POINTS]: "",
  [APP_KEYS.SKORSING_POINTS]: "",
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

export async function getPrintBlock(): Promise<{ redaksi: string }> {
  const redaksi = await getAppSetting(APP_KEYS.REDAKSI_PRINT);
  return { redaksi: redaksi || DEFAULTS[APP_KEYS.REDAKSI_PRINT] };
}
