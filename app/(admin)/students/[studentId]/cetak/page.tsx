import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrintBlock, getQuietPeriodDays } from "@/lib/app-settings";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import { isStaffRole } from "@/lib/staff-roles";
import { PrintButton } from "@/components/PrintButton";
import { StudentPointsPrintArticle } from "@/components/StudentPointsPrintArticle";

export default async function StaffStudentPrintPointsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const { studentId } = await params;

  const [print, student, breakdown, records, adjustments, quietDays] = await Promise.all([
    getPrintBlock(),
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

  const issued = new Date();

  return (
    <div className="pb-safe-bottom">
      <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/students" className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
          ← Kembali ke daftar siswa
        </Link>
        <PrintButton />
      </div>

      <StudentPointsPrintArticle
        studentName={student.name}
        nisn={student.nisn}
        classNameLabel={student.class?.name ?? null}
        issued={issued}
        print={print}
        breakdown={breakdown}
        quietDays={quietDays}
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

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
