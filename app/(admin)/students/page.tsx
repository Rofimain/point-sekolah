import { prisma } from "@/lib/prisma";
import { getSafeServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentsClient from "./StudentsClient";
import type { Prisma } from "@/generated/prisma/client";
import { indonesianAcademicYearLabel } from "@/lib/academic-year";
import { isStaffRole } from "@/lib/staff-roles";
import { getEffectivePointsMap } from "@/lib/student-effective-points";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string; tab?: string; classId?: string }>;
}) {
  const query = await searchParams;
  const session = await getSafeServerSession();
  if (!session?.user?.role || !isStaffRole(session.user.role)) {
    redirect("/dashboard");
  }

  const page = parseInt(query.page || "1", 10);
  const perPage = 25;
  const where: Prisma.UserWhereInput = { role: "STUDENT", deletedAt: null };
  if (query.classId) {
    where.classId = query.classId;
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { nisn: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [students, total, classes, latestClass, effectivePointsMap] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        nisn: true,
        active: true,
        status: true,
        photoPresent: true,
        class: { select: { name: true, grade: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
    prisma.class.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.class.findFirst({ orderBy: { createdAt: "desc" }, select: { year: true } }),
    getEffectivePointsMap(),
  ]);

  const totalPointsMap: Record<string, number> = {};
  for (const s of students) {
    totalPointsMap[s.id] = effectivePointsMap.get(s.id) ?? 0;
  }

  const studentDomain = process.env.NEXT_PUBLIC_STUDENT_DOMAIN || "siswa.sman1contoh.sch.id";
  const suggestedYear = latestClass?.year ?? indonesianAcademicYearLabel();

  return (
    <StudentsClient
      students={students}
      total={total}
      page={page}
      perPage={perPage}
      classes={classes}
      searchParams={query}
      studentDomain={studentDomain}
      viewerRole={session.user.role}
      suggestedYear={suggestedYear}
      totalPointsMap={totalPointsMap}
    />
  );
}
