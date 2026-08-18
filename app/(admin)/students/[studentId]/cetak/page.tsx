import { notFound, redirect } from "next/navigation";
import { getSafeServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrintBlock, getQuietPeriodDays } from "@/lib/app-settings";
import { getEffectivePointsBreakdown, isPointAdjustmentTableMissing } from "@/lib/student-effective-points";
import { isStaffRole } from "@/lib/staff-roles";
import { StudentPointsPrintClient } from "@/components/StudentPointsPrintClient";
import { syncDefaultTemplates } from "@/lib/sync-print-templates";
import { Prisma } from "@/generated/prisma/client";

function isPrintTemplateTableMissing(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2021" &&
    (e.meta as { modelName?: string } | undefined)?.modelName === "PrintTemplate"
  );
}

export default async function StaffStudentPrintPointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ from?: string; template?: string }>;
}) {
  const session = await getSafeServerSession();
  if (!session || !isStaffRole(session.user.role)) redirect("/admin/login");

  const { studentId } = await params;
  const sp = await searchParams;
  const fromCetakSurat = sp.from === "cetak-surat";

  const [print, student, breakdown, records, adjustments, quietDays] = await Promise.all([
    getPrintBlock(),
    prisma.user.findFirst({
      where: { id: studentId, role: "STUDENT" },
      include: { class: true },
    }),
    getEffectivePointsBreakdown(studentId),
    prisma.violationRecord.findMany({
      where: { studentId, deletedAt: null },
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

  await syncDefaultTemplates();

  let letterTemplates: { id: string; slug: string; title: string; body: string; pageSettings: string | null }[] = [];
  try {
    letterTemplates = await prisma.printTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, slug: true, title: true, body: true, pageSettings: true },
    });
  } catch (e) {
    if (!isPrintTemplateTableMissing(e)) throw e;
  }

  return (
    <StudentPointsPrintClient
      studentName={student.name}
      nisn={student.nisn}
      classNameLabel={student.class?.name ?? null}
      address={null}
      issued={new Date()}
      redaksi={print.redaksi}
      letterTemplates={letterTemplates}
      initialTemplateSlug={sp.template ?? null}
      backHref={fromCetakSurat ? "/cetak-surat" : "/students"}
      backLabel={fromCetakSurat ? "← Kembali ke Cetak surat" : "← Kembali ke daftar siswa"}
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
  );
}
