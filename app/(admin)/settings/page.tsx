import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { APP_KEYS, getAppSetting } from "@/lib/app-settings";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSafeServerSession();
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/dashboard");

  const initial = {
    [APP_KEYS.COORD_NAME]: await getAppSetting(APP_KEYS.COORD_NAME),
    [APP_KEYS.COORD_TITLE]: await getAppSetting(APP_KEYS.COORD_TITLE),
    [APP_KEYS.REDAKSI_PRINT]: await getAppSetting(APP_KEYS.REDAKSI_PRINT),
    [APP_KEYS.NEXT_REVIEW_VIOLATIONS]: await getAppSetting(APP_KEYS.NEXT_REVIEW_VIOLATIONS),
    [APP_KEYS.NEXT_REVIEW_ROSTER]: await getAppSetting(APP_KEYS.NEXT_REVIEW_ROSTER),
  };

  return <SettingsClient initial={initial} />;
}
