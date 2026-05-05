import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrintBlock } from "@/lib/app-settings";
import { getEffectivePointsBreakdown } from "@/lib/student-effective-points";
import { isStaffRole } from "@/lib/staff-roles";
import { PrintButton } from "@/components/PrintButton";
import { StudentPointsPrintArticle } from "@/components/StudentPointsPrintArticle";

export default async function StaffStudentPrintPointsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const { studentId } = await params;

  const [print, student, breakdown] = await Promise.all([
    getPrintBlock(),
    prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      include: { class: true },
    }),
    getEffectivePointsBreakdown(studentId),
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
