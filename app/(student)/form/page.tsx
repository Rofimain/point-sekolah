import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudentFormClient from "./StudentFormClient";
import { getQuietPeriodDays } from "@/lib/app-settings";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";

/** Form siswa query DB per session — skip static generation saat image build. */
export const dynamic = "force-dynamic";

export default async function StudentFormPage() {
  const session = await getSafeServerSession();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const violationTypes = await prisma.violationType.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { points: "asc" }],
  });

  const records = await prisma.violationRecord.findMany({
    where: { studentId: session.user.id },
    select: {
      id: true,
      studentId: true,
      violationTypeId: true,
      session: true,
      notes: true,
      points: true,
      date: true,
      createdByName: true,
      evidenceImagePresent: true,
      createdAt: true,
      updatedAt: true,
      violationType: true,
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  const [{ gross, adjustmentSum, effective }, quietDays] = await Promise.all([
    getEffectivePointsBreakdown(session.user.id),
    getQuietPeriodDays(),
  ]);

  let pointAdjustments: {
    id: string;
    pointsDelta: number;
    reason: string;
    grossTotalBefore: number;
    createdAt: Date;
  }[] = [];
  try {
    pointAdjustments = await prisma.pointAdjustment.findMany({
      where: { studentId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        pointsDelta: true,
        reason: true,
        grossTotalBefore: true,
        createdAt: true,
      },
    });
  } catch (e) {
    if (!isPointAdjustmentTableMissing(e)) throw e;
  }

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
      pointAdjustments={pointAdjustments}
      quietDays={quietDays}
      studentClass={student?.class?.name ?? null}
      studentNisn={student?.nisn ?? null}
    />
  );
}
