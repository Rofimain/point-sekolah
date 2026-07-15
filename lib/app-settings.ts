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
};

export async function getAppSetting(key: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value != null && row.value !== "") return row.value;
  return DEFAULTS[key] ?? "";
}

export async function getPrintBlock(): Promise<{
  coordinatorName: string;
  coordinatorTitle: string;
  redaksi: string;
}> {
  const [coordinatorName, coordinatorTitle, redaksi] = await Promise.all([
    getAppSetting(APP_KEYS.COORD_NAME),
    getAppSetting(APP_KEYS.COORD_TITLE),
    getAppSetting(APP_KEYS.REDAKSI_PRINT),
  ]);
  return {
    coordinatorName: coordinatorName || "_______________________",
    coordinatorTitle: coordinatorTitle || "Koordinator BP/BK",
    redaksi: redaksi || DEFAULTS[APP_KEYS.REDAKSI_PRINT],
  };
}
