import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isStaffRole, isSuperAdmin } from "@/lib/staff-roles";
import { getAppSetting } from "@/lib/app-settings";
import { APP_KEYS } from "@/lib/app-setting-keys";
import RemisiOtomatisClient from "./RemisiOtomatisClient";

export const dynamic = "force-dynamic";

export default async function RemisiOtomatisPage() {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const [aktifRaw, classes] = await Promise.all([
    getAppSetting(APP_KEYS.REMISI_BERANTAI_AKTIF),
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <RemisiOtomatisClient
      isSuperAdmin={isSuperAdmin(session.user.role)}
      aktif={aktifRaw === "1"}
      classes={classes}
    />
  );
}
