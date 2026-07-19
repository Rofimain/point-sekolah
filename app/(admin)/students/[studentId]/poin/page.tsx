import { notFound, redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQuietPeriodDays } from "@/lib/app-settings";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import { isStaffRole } from "@/lib/staff-roles";
import { StudentPointsDetailView } from "@/components/StudentPointsDetailView";

export default async function StaffStudentPointsDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const { studentId } = await params;

  const [student, breakdown, records, adjustments, quietDays] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      include: { class: true },
    }),
    getEffectivePointsBreakdown(studentId),
    prisma.violationRecord.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      take: 60,
      select: {
        id: true,
        date: true,
        points: true,
        notes: true,
        violationType: { select: { name: true } },
      },
    }),
    (async () => {
      try {
        return await prisma.pointAdjustment.findMany({
          where: { studentId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, createdAt: true, pointsDelta: true, reason: true, grossTotalBefore: true },
        });
      } catch (e) {
        if (isPointAdjustmentTableMissing(e)) return [];
        throw e;
      }
    })(),
    getQuietPeriodDays(),
  ]);

  if (!student) notFound();

  return (
    <StudentPointsDetailView
      studentName={student.name}
      nisn={student.nisn}
      classNameLabel={student.class?.name ?? null}
      quietDays={quietDays}
      breakdown={breakdown}
      cetakHref={`/students/${student.id}/cetak`}
      history={{
        records: records.map((r) => ({
          id: r.id,
          date: r.date,
          violationName: r.violationType.name,
          points: r.points,
          notes: r.notes,
        })),
        adjustments,
      }}
    />
  );
}
