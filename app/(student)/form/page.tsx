import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentFormClient from "./StudentFormClient";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";

export default async function StudentFormPage() {
  const session = await getSafeServerSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const violationTypes = await prisma.violationType.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { points: "asc" }],
  });

  const records = await prisma.violationRecord.findMany({
    where: { studentId: session.user.id },
    include: { violationType: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const { gross, adjustmentSum, effective } = await getEffectivePointsBreakdown(session.user.id);

  const student = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { class: true },
  });

  return (
    <StudentFormClient
      session={session}
      violationTypes={violationTypes}
      records={records}
      totalPoints={effective}
      grossPoints={gross}
      adjustmentSum={adjustmentSum}
      studentClass={student?.class?.name ?? null}
      studentNisn={student?.nisn ?? null}
    />
  );
}
