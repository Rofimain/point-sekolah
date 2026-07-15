import { prisma } from "@/lib/prisma";
import ViolationsClient from "./ViolationsClient";
import { getSafeServerSession } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";

export default async function ViolationsPage() {
  const [violations, session] = await Promise.all([
    prisma.violationType.findMany({ orderBy: [{ category: "asc" }, { points: "asc" }] }),
    getSafeServerSession(),
  ]);
  return <ViolationsClient violations={violations} canManage={canManageData(session?.user?.role)} />;
}
