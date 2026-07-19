import { prisma } from "@/lib/prisma";
import ViolationsClient from "./ViolationsClient";
import { getSafeServerSession } from "@/lib/auth";
import { canManageData } from "@/lib/staff-roles";
import { listViolationBagian } from "@/lib/violation-bagian";

export default async function ViolationsPage() {
  const [violations, session, bagian] = await Promise.all([
    prisma.violationType.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { points: "asc" }, { name: "asc" }],
    }),
    getSafeServerSession(),
    listViolationBagian(),
  ]);
  return (
    <ViolationsClient
      violations={violations}
      bagian={bagian}
      canManage={canManageData(session?.user?.role)}
    />
  );
}
