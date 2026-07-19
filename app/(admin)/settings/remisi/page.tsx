import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageData } from "@/lib/staff-roles";
import {
  getAdjustmentSumByStudent,
  getGrossPointsByStudent,
} from "@/lib/student-effective-points";
import RemisiClient from "./RemisiClient";

export default async function RemisiPage() {
  const session = await getSafeServerSession();
  if (!canManageData(session?.user?.role)) redirect("/dashboard");

  const [rows, grossMap, adjMap] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        nisn: true,
        class: { select: { name: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    getGrossPointsByStudent(),
    getAdjustmentSumByStudent(),
  ]);

  const students = rows.map((s) => {
    const gross = grossMap.get(s.id) ?? 0;
    const adj = adjMap.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.name,
      nisn: s.nisn,
      className: s.class?.name ?? null,
      gross,
      effective: Math.max(0, gross + adj),
    };
  });

  return <RemisiClient students={students} />;
}
