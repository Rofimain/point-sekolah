import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { APP_KEYS, getAppSettingsMap } from "@/lib/app-settings";
import SettingsClient from "./SettingsClient";
import { canManageData } from "@/lib/staff-roles";

const SETTINGS_PAGE_KEYS = [
  APP_KEYS.COORD_NAME,
  APP_KEYS.COORD_TITLE,
  APP_KEYS.NEXT_REVIEW_VIOLATIONS,
  APP_KEYS.NEXT_REVIEW_ROSTER,
  APP_KEYS.SP1_POINTS,
  APP_KEYS.SP2_POINTS,
  APP_KEYS.SP3_POINTS,
  APP_KEYS.SKORSING_POINTS,
] as const;

export default async function SettingsPage() {
  const session = await getSafeServerSession();
  if (!canManageData(session?.user?.role)) redirect("/dashboard");

  const initial = await getAppSettingsMap(SETTINGS_PAGE_KEYS);
  return <SettingsClient initial={initial} />;
}
