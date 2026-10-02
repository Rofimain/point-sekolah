import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData, isStaffRole } from "@/lib/staff-roles";
import RemisiManualClient from "./RemisiManualClient";

export const dynamic = "force-dynamic";

export default async function RemisiManualPage() {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const classes = await prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <RemisiManualClient canManage={canManageData(session.user.role)} classes={classes} />;
}
